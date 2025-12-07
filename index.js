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

    // Get all assets
app.get("/assets", async (req, res) => {
  try {
    const assets = await assetsCollection.find({}).toArray();
    res.send(assets);
  } catch (err) {
    res.status(500).send({ error: "Failed to fetch assets" });
  }
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
    const { productName, productImage, productType, productQuantity, hrEmail, companyName } = req.body;

    if (!productName || !productQuantity || !productType || !hrEmail) {
      return res.status(400).send({ error: "All fields required including hrEmail" });
    }

    const asset = {
      productName,
      productImage,
      productType,
      productQuantity: parseInt(productQuantity),
      availableQuantity: parseInt(productQuantity),
      dateAdded: new Date(),
      hrEmail,
      companyName,
    };

    const result = await assetsCollection.insertOne(asset);
    res.send({ success: true, asset: result });

  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false });
  }
});





app.delete("/assets/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const result = await assetsCollection.deleteOne({ _id: new ObjectId(id) });

    res.send({ success: true, result });
  } catch (err) {
    console.error(err);
    res.status(500).send({ success: false, message: "Failed to delete asset" });
  }
});


app.put("/assets/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const updatedData = req.body;

    const result = await assetsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updatedData }
    );

    res.send({ success: true, result });
  } catch (err) {
    console.error(err);
    res.status(500).send({ success: false, message: "Failed to update asset" });
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



app.get("/hr-requests/:hrEmail", async (req, res) => {
  try {
    const hrEmail = req.params.hrEmail;

    const requests = await requestsCollection
      .find({ hrEmail })
      .sort({ requestDate: -1 })
      .toArray();

    res.send({ success: true, requests });
  } catch (err) {
    console.error(err);
    res.status(500).send({ success: false, message: "Failed to fetch HR requests" });
  }
});



app.put("/requests/approve/:id", async (req, res) => {
  try {
    const requestId = req.params.id;
    const request = await requestsCollection.findOne({ _id: new ObjectId(requestId) });

    if (!request) {
      return res.status(404).send({ success: false, message: "Request not found" });
    }

    // Deduct quantity
    await assetsCollection.updateOne(
      { _id: new ObjectId(request.assetId) },
      { $inc: { availableQuantity: -1 } }
    );

    // Approve request
    await requestsCollection.updateOne(
      { _id: new ObjectId(requestId) },
      {
        $set: {
          requestStatus: "approved",
          approvalDate: new Date(),
        },
      }
    );

    // Add asset to employee
    await usersCollection.updateOne(
      { email: request.requesterEmail },
      {
        $push: {
          myAssets: {
            assetId: request.assetId,
            assetName: request.assetName,
            dateAssigned: new Date(),
          },
        },
      }
    );

    // Assign HR if not already assigned
    await usersCollection.updateOne(
      { email: request.requesterEmail },
      { $set: { assignedHR: request.hrEmail } }
    );

    res.send({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).send({ success: false });
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




app.put("/requests/reject/:id", async (req, res) => {
  try {
    const requestId = req.params.id;

    await requestsCollection.updateOne(
      { _id: new ObjectId(requestId) },
      {
        $set: {
          requestStatus: "rejected",
          approvalDate: null,
        },
      }
    );

    res.send({ success: true, message: "Request rejected" });
  } catch (err) {
    res.status(500).send({ success: false });
  }
});


app.get("/hr/team-members/:hrEmail", async (req, res) => {
  try {
    const hrEmail = req.params.hrEmail;

    // find employees under this HR
    const employees = await usersCollection
      .find({ assignedHR: hrEmail })
      .project({ name: 1, email: 1, photo: 1, myAssets: 1, joinDate: 1 })
      .toArray();

    // map asset count
    const employeeList = employees.map(emp => ({
      _id: emp._id,
      name: emp.name,
      email: emp.email,
      photo: emp.photo || "",
      joinDate: emp.joinDate,
      assetsCount: emp.myAssets ? emp.myAssets.length : 0
    }));

    res.send({ success: true, employees: employeeList });
  } catch (err) {
    console.error(err);
    res.status(500).send({ success: false, message: "Failed to fetch employees" });
  }
});


app.put("/hr/remove-employee/:id", async (req, res) => {
  try {
    const empId = req.params.id;
    const { hrEmail } = req.body;

    await usersCollection.updateOne(
      { _id: new ObjectId(empId), assignedHR: hrEmail },
      { $unset: { assignedHR: "" } }
    );

    res.send({ success: true, message: "Employee removed from team" });
  } catch (err) {
    console.error(err);
    res.status(500).send({ success: false });
  }
});


app.get("/employee/assets/:email", async (req, res) => {
  try {
    const email = req.params.email;

    // Find assets assigned to this employee
    const assets = await assetsCollection
      .find({ assignedTo: email }) // assuming asset has assignedTo field
      .toArray();

    res.send({ success: true, assets });
  } catch (err) {
    console.error(err);
    res.status(500).send({ success: false, message: "Failed to fetch assets" });
  }
});


app.get("/users/:email", async (req, res) => {
  try {
    const email = req.params.email;

    const user = await usersCollection.findOne({ email });

    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    res.send(user);
  } catch (error) {
    res.status(500).send({ message: "Server error" });
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
