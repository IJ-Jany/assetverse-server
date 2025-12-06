import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient, ObjectId } from "mongodb";


dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// MongoDB  connection
const client = new MongoClient(process.env.MONGO_URI);

async function startServer() {
  try {
    await client.connect();
    console.log("MongoDB Connected");

    const db = client.db("assetverse");
    const usersCollection = db.collection("usersCollection");
     const packagesCollection = db.collection("packages");
     const assetsCollection = db.collection("assets")
      const requestsCollection = db.collection("requests")

    // Test route
    app.get("/", (req, res) => {
      res.send("AssetVerse Backend Running");
    });

    app.post('/user',async(req,res)=>{
      const userData=req.body
      userData.created_at= new Date().toISOString()
      userData.last_loggedIn= new Date().toISOString()
      
      const query = {
        email:userData.email
      }

      const alreadyExists = await usersCollection.findOne(query)
console.log(query,alreadyExists)
      if(alreadyExists){
        const result = await usersCollection.updateOne(query,{$set:{
          last_loggedIn:new Date().toISOString()
        }})
        return res.send(result)
      }
      const result = await usersCollection.insertOne(userData)
      console.log(result)
      res.send(result)
    })

       app.get("/packages", async (req, res) => {
      try {
        const packages = await packagesCollection.find().toArray();
        res.send(packages);
      } catch (error) {
        console.error("Failed to fetch packages:", error);
        res.status(500).send({ error: "Failed to fetch packages" });
      }
    });


    app.get('/user/role/:email',async (req,res)=>{
      const email = req.params.email
      const result = await usersCollection.findOne({email})
      res.send({role: result?.role})
    })

    // POST /assets
app.post("/assets", async (req, res) => {
  try {
    const {
      productName,
      productImage,
      productType,
      productQuantity,
      hrEmail,
      companyName
    } = req.body;

    if (!productName || !productQuantity || !productType) {
      return res.status(400).send({ error: "Name, quantity, and type are required" });
    }

    const asset = {
      productName,
      productImage: productImage || "",
      productType, // "Returnable" or "Non-returnable"
      productQuantity: parseInt(productQuantity),
      availableQuantity: parseInt(productQuantity), // Initially all available
      dateAdded: new Date(),
      hrEmail: hrEmail || "", // HR who added this
      companyName: companyName || "",
    };

    const result = await assetsCollection.insertOne(asset);
    res.send({ success: true, asset: result });
  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, error: "Internal Server Error" });
  }
});

// Get all assets
app.get("/assets", async (req, res) => {
  try {
    const assets = await assetsCollection.find({}).toArray();
    res.send(assets);
  } catch (err) {
    res.status(500).send({ error: "Failed to fetch assets" });
  }
});


app.post("/requests", async (req, res) => {
  try {
    const {
      assetId,
      assetName,
      assetType,
      requesterName,
      requesterEmail,
      hrEmail,
      companyName,
      note,
    } = req.body;

    if (!assetId || !requesterEmail) {
      return res.status(400).send({ success: false, message: "Required fields missing" });
    }

    const requestDoc = {
      assetId: new ObjectId(assetId),
      assetName,
      assetType,
      requesterName,
      requesterEmail,
      hrEmail: hrEmail || "",
      companyName: companyName || "",
      note: note || "",
      requestDate: new Date(),
      approvalDate: null,
      requestStatus: "pending",
      processedBy: ""
    };

    const result = await requestsCollection.insertOne(requestDoc);
    res.status(201).send({ success: true, requestId: result.insertedId });
  } catch (err) {
    console.error(err);
    res.status(500).send({ success: false, message: "Failed to create request" });
  }
});


// Get employee requests
app.get("/my-requests", async (req, res) => {
  const { email } = req.query;
  try {
    const requests = await requestsCollection.find({ requesterEmail: email }).toArray();
    res.send(requests);
  } catch (err) {
    res.status(500).send({ error: "Failed to fetch requests" });
  }
});

// Get team members for an employee based on assigned HR
app.get("/team-members/:employeeEmail", async (req, res) => {
  try {
    const employeeEmail = req.params.employeeEmail;

    // 1. Find the HR assigned to this employee
    const employee = await usersCollection.findOne({ email: employeeEmail });
    if (!employee || !employee.assignedHR) {
      return res.send({ success: true, team: [] }); // no HR assigned
    }

    const hrEmail = employee.assignedHR;

    // 2. Find all employees under this HR
    const teamMembers = await usersCollection
      .find({ assignedHR: hrEmail })
      .project({ name: 1, email: 1, photo: 1 })
      .toArray();

    res.send({ success: true, team: teamMembers });
  } catch (err) {
    console.error(err);
    res.status(500).send({ success: false, message: "Failed to fetch team members" });
  }
});


// Get HRs for an employee based on approved requests
app.get("/team-hrs/:employeeEmail", async (req, res) => {
  try {
    const employeeEmail = req.params.employeeEmail;

    // Find all requests made by this employee that are approved
    const approvedRequests = await requestsCollection
      .find({ requesterEmail: employeeEmail, requestStatus: "approved" })
      .project({ hrEmail: 1 })
      .toArray();

    // Extract unique HR emails
    const hrEmails = [...new Set(approvedRequests.map((r) => r.hrEmail))];

    // Get HR details from usersCollection
    const hrList = await usersCollection
      .find({ email: { $in: hrEmails } })
      .project({ name: 1, email: 1, photo: 1 })
      .toArray();

    res.send({ success: true, hrs: hrList });
  } catch (err) {
    console.error(err);
    res.status(500).send({ success: false, message: "Failed to fetch HRs" });
  }
});


// Get all requests for a specific HR
app.get("/hr-requests/:hrEmail", async (req, res) => {
  try {
    const hrEmail = req.params.hrEmail;

    // Find all requests where this HR is assigned
    const requests = await requestsCollection
      .find({ hrEmail })
      .toArray();

    res.send({ success: true, requests });
  } catch (err) {
    console.error(err);
    res.status(500).send({ success: false, message: "Failed to fetch HR requests" });
  }
});


// Approve / Reject Request
app.patch("/requests/update/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const { status, hrEmail } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).send({ success: false, message: "Invalid status" });
    }

    // Update request
    const result = await requestsCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          requestStatus: status,
          processedBy: hrEmail,
          approvalDate: new Date()
        }
      }
    );

    if (status === "approved") {
      // Assign employee under HR
      const reqData = await requestsCollection.findOne({ _id: new ObjectId(id) });

      await usersCollection.updateOne(
        { email: reqData.requesterEmail },
        {
          $addToSet: { assignedHRs: reqData.hrEmail } // multiple HR support
        }
      );
    }

    res.send({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).send({ success: false, message: "Failed to update request" });
  }
});




  

    // Start server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

  } catch (error) {
    console.log("Database Connection Failed:", error);
  }
}

startServer();
