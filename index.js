import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Stripe from "stripe";
import admin from 'firebase-admin';
import { MongoClient,ServerApiVersion, ObjectId } from "mongodb";
dotenv.config();
const decoded = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString(
  'utf-8'
)


const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// MongoDB  connection
const client = new MongoClient(process.env.MONGO_URI);

// jwt middlewares
const verifyJWT = async (req, res, next) => {
  const token = req?.headers?.authorization?.split(' ')[1]
  console.log(token)
  if (!token) return res.status(401).send({ message: 'Unauthorized Access!' })
  try {
    const decoded = await admin.auth().verifyIdToken(token)
    req.tokenEmail = decoded.email
    console.log(decoded)
    next()
  } catch (err) {
    console.log(err)
    return res.status(401).send({ message: 'Unauthorized Access!', err })
  }
}

 // role middlewares
    const verifyHR = async (req, res, next) => {
      const email = req.tokenEmail
      const user = await usersCollection.findOne({ email })
      if (user?.role !== 'hr')
        return res
          .status(403)
          .send({ message: 'hr only Actions!', role: user?.role })

      next()
    }
    const verifyEmployee = async (req, res, next) => {
      const email = req.tokenEmail
      const user = await usersCollection.findOne({ email })
      if (user?.role !== 'employee')
        return res
          .status(403)
          .send({ message: 'employee only Actions!', role: user?.role })

      next()
    }

async function updateMyAssets(db) {
  // const usersCollection = db.collection("usersCollection");
  // const assetsCollection = db.collection("assets");

  const users = await usersCollection.find({}).toArray();

  for (const user of users) {
    if (user.myAssets && user.myAssets.length > 0) {
      for (let i = 0; i < user.myAssets.length; i++) {
        const assetId = user.myAssets[i].assetId;
        const asset = await assetsCollection.findOne({ _id: new ObjectId(assetId) });
        if (asset) {
          await usersCollection.updateOne(
            { _id: user._id, "myAssets.assetId": assetId },
            {
              $set: {
                "myAssets.$.assetName": asset.productName,
                "myAssets.$.assetType": asset.productType,
                "myAssets.$.assetImage": asset.productImage || "",
                "myAssets.$.companyName": asset.companyName || "",
                "myAssets.$.status": "approved",
                "myAssets.$.assignmentDate": asset.dateAdded
              }
            }
          );
        }
      }
    }
  }
  console.log("✅ All myAssets updated successfully!");
}


async function startServer() {
  try {
    await client.connect();
    console.log("MongoDB Connected");

    const db = client.db("assetverse");
    const usersCollection = db.collection("usersCollection");
     const packagesCollection = db.collection("packages");
     const assetsCollection = db.collection("assets")
      const requestsCollection = db.collection("requests")
    app.get("/", (req, res) => {
      res.send("AssetVerse Backend Running");
    });

app.post("/requests",verifyJWT,verifyEmployee, async (req, res) => {
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


app.post("/assets",verifyJWT,verifyHR, async (req, res) => {
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


app.get("/assets/:email",verifyJWT,verifyEmployee, async (req, res) => {
  try {
    const hrEmail = req.params.email;

    console.log("📥 HR email received:", hrEmail);

    // FILTER assets by hrEmail
    const assets = await assetsCollection
      .find({ hrEmail })
      .toArray();

    console.log("📤 Assets found:", assets.length);

    res.send(assets);

  } catch (err) {
    console.error("❌ Error fetching assets:", err);
    res.status(500).json({ error: "Failed to fetch assets" });
  }
});

app.delete("/assets/:id",verifyJWT,verifyHR, async (req, res) => {
  try {
    const id = req.params.id;
    const result = await assetsCollection.deleteOne({ _id: new ObjectId(id) });

    res.send({ success: true, result });
  } catch (err) {
    console.error(err);
    res.status(500).send({ success: false, message: "Failed to delete asset" });
  }
});

app.put("/assets/:id",verifyJWT,verifyHR, async (req, res) => {
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

app.get("/hr/team-members/:hrEmail",verifyJWT,verifyEmployee, async (req, res) => {
  try {
    const hrEmail = req.params.hrEmail;

    // HR info to get packageLimit & currentEmployees
    const hr = await usersCollection.findOne({ email: hrEmail });

    // find employees under this HR
    const employees = await usersCollection
      .find({ assignedHR: hrEmail })
      .project({ name: 1, email: 1, photo: 1, myAssets: 1, joinDate: 1 })
      .toArray();

    const employeeList = employees.map(emp => ({
      _id: emp._id,
      name: emp.name,
      email: emp.email,
      photo: emp.photo || "",
      joinDate: emp.joinDate || null,
      assetsCount: emp.myAssets ? emp.myAssets.length : 0
    }));

    res.send({
      success: true,
      employees: employeeList,
      currentCount: employeeList.length,
      packageLimit: hr?.packageLimit || 5
    });

  } catch (err) {
    console.error(err);
    res.status(500).send({ success: false, message: "Failed to fetch employees" });
  }
});



app.put("/hr/remove-employee/:id",verifyJWT,verifyHR, async (req, res) => {
  try {
    const empId = req.params.id;
    const { hrEmail } = req.body;

    await usersCollection.updateOne(
      { _id: new ObjectId(empId), assignedHR: hrEmail },
      { $unset: { assignedHR: "",joinDate:""} }
    );

    res.send({ success: true, message: "Employee removed from team" });
  } catch (err) {
    console.error(err);
    res.status(500).send({ success: false });
  }
});

app.get("/hr-requests/:hrEmail",verifyJWT,verifyHR, async (req, res) => {
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

app.put("/requests/reject/:id",verifyJWT,verifyHR, async (req, res) => {
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

app.put("/requests/approve/:id", verifyJWT, verifyHR, async (req, res) => {
  try {
    const requestId = req.params.id;

    const request = await requestsCollection.findOne({ _id: new ObjectId(requestId) });
    if (!request) {
      return res.status(404).send({ success: false, message: "Request not found" });
    }

    const asset = await assetsCollection.findOne({ _id: new ObjectId(request.assetId) });
    if (!asset) {
      return res.status(404).send({ success: false, message: "Asset not found" });
    }

    // Check employee limit (you stored employeeLimit)
    const hr = await usersCollection.findOne({ email: request.hrEmail });
    const MAX_EMPLOYEES = hr?.employeeLimit || 5;    // <-- FIXED

    const employeeCount = await usersCollection.countDocuments({ assignedHR: request.hrEmail });
    if (employeeCount >= MAX_EMPLOYEES) {
      return res.status(400).send({
        success: false,
        message: `Employee limit reached (${MAX_EMPLOYEES})`
      });
    }

    await assetsCollection.updateOne(
      { _id: asset._id },
      { $inc: { availableQuantity: -1 } }
    );

    const approvalDate = new Date();

    await requestsCollection.updateOne(
      { _id: request._id },
      { $set: { requestStatus: "approved", approvalDate } }
    );

    await usersCollection.updateOne(
      { email: request.requesterEmail },
      {
        $push: {
          myAssets: {
            assetId: asset._id,
            assetName: asset.productName,
            assetType: asset.productType,
            assetImage: asset.productImage || "",
            companyName: asset.companyName || "",
            requestDate: request.requestDate,
            approvalDate,
            status: "approved"
          }
        }
      }
    );

    await usersCollection.updateOne(
      { email: request.requesterEmail },
      { $set: { assignedHR: request.hrEmail, joinDate: new Date() } }
    );

    res.send({ success: true, message: "Request approved successfully!" });

  } catch (err) {
    console.error("APPROVE ERROR:", err);
    res.status(500).send({ success: false, message: "Error approving request" });
  }
});



app.get("/employee/assets/:email", async (req, res) => {
  try {
    const email = req.params.email;
    const user = await usersCollection.findOne({ email });

    if (!user) return res.send({ success: true, assets: [] });
    res.send({ success: true, assets: user.myAssets || [] });
  } catch (err) {
    console.error(err);
    res.status(500).send({ success: false, message: "Failed to fetch assets" });
  }
});

app.put("/assets/return/:id",verifyEmployee,verifyJWT, async (req, res) => {
  const assetId = req.params.id;
  await usersCollection.updateOne(
    { "myAssets.assetId": new ObjectId(assetId) },
    { $set: { "myAssets.$.status": "returned" } }
  );
  await assetsCollection.updateOne(
    { _id: new ObjectId(assetId) },
    { $inc: { availableQuantity: 1 } }
  );
  res.send({ success: true });
});

app.get("/my-team/:email", async (req, res) => {
  try {
    const email = req.params.email;

    // 1. Current user
    const employee = await usersCollection.findOne({ email });
    if (!employee)
      return res.send({ success: true, hrs: [], colleagues: [], company: "" });

    const company = employee.companyName || "";

    // 2. HR list (from approved requests)
    const approvedRequests = await requestsCollection
      .find({ requesterEmail: email, requestStatus: "approved" })
      .project({ hrEmail: 1 })
      .toArray();

    const hrEmails = [...new Set(approvedRequests.map(r => r.hrEmail))];

    const hrs = await usersCollection
      .find({ email: { $in: hrEmails } })
      .project({ name: 1, email: 1, photo: 1, companyName: 1, position: 1 })
      .toArray();

    // 3. Colleagues from same company
    const colleagues = await usersCollection
      .find({ companyName: company, email: { $ne: email } })
      .project({ name: 1, email: 1, photo: 1, position: 1, companyName: 1 })
      .toArray();

    res.send({
      success: true,
      hrs,
      colleagues,
      company,
    });
  } catch (err) {
    console.log(err);
    res.status(500).send({ success: false });
  }
});


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

app.post("/assigned-users",verifyHR,verifyJWT ,async (req, res) => {
  try {
    const assignedData = {
      hrEmail: req.body.hrEmail,
      employeeEmail: req.body.employeeEmail,
      employeeName: req.body.employeeName,
      companyName: req.body.companyName,
      assetName: req.body.assetName,
      assignedDate: req.body.assignedDate,
    };

    const result = await assignedUsersCollection.insertOne(assignedData);

    res.send({ success: true, result });
  } catch (error) {
    console.error("Insert Assigned User Error:", error);
    res.status(500).send({ success: false, message: "Failed to assign user" });
  }
});


app.get("/upcoming-birthdays", async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) return res.status(400).send({ success: false, message: "Email is required" });

    // 1. Find the current user
    const user = await usersCollection.findOne({ email });
    if (!user || !user.companyName) {
      return res.send({ success: true, birthdays: [] }); // No company info
    }

    const companyName = user.companyName;
    const currentMonth = new Date().getMonth() + 1; // 1-12

    // 2. Find employees in the same company
    const employees = await usersCollection
      .find({ companyName })
      .project({ name: 1, email: 1, dob: 1 })
      .toArray();

    // 3. Filter by current month
    const birthdays = employees.filter(emp => {
      if (!emp.dob) return false;
      const dobMonth = new Date(emp.dob).getMonth() + 1;
      return dobMonth === currentMonth;
    });

    res.send({ success: true, birthdays });
  } catch (err) {
    console.error(err);
    res.status(500).send({ success: false, message: "Failed to fetch upcoming birthdays" });
  }
});


app.post('/create-checkout-session', async (req, res) => {
  try {
    const { name, price, hrEmail, packageId } = req.body;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",

      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name },
            unit_amount: price * 100,
          },
          quantity: 1,
        },
      ],

      metadata: {
        hrEmail,
        packageId,
      },

      success_url: `http://localhost:5173/pay-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `http://localhost:5173/dashboard/upgrade-package`,
    });

    res.send({ url: session.url });
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: "Stripe error" });
  }
});


app.post("/verify-payment", async (req, res) => {
  try {
    const { sessionId } = req.body;

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === "paid") {
      const hrEmail = session.metadata.hrEmail;
      const packageId = session.metadata.packageId;
        const pkg = await packagesCollection.findOne({
        _id: new ObjectId(packageId)
      });
       if (!pkg) {
        return res.status(404).send({ success: false, message: "Package not found" });
      }

      // Update HR package inside usersCollection
      await usersCollection.updateOne(
        { email: hrEmail },
        {
          $set: {
            packageId: packageId,
            packagePurchasedAt: new Date(),
              employeeLimit: pkg.employeeLimit   
          }
        }
      );

      return res.send({ success: true });
    }

    res.send({ success: false });

  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false });
  }
});

app.get("/users/:email", async (req, res) => {
  try {
    const email = req.params.email;

    const user = await usersCollection.findOne(
      { email },
      {
        projection: {
          name: 1,
          email: 1,
          role: 1,
          profileImage: 1,
          packageId: 1,          // Add this
          packagePurchasedAt: 1  // Add this
        }
      }
    );

    if (!user) {
      return res.status(404).send({ success: false, message: "User not found" });
    }

    res.send({ success: true, user });
  } catch (err) {
    console.error(err);
    res.status(500).send({ success: false, message: "Server error" });
  }
});

app.get("/packages/:id", async (req, res) => {
  try {
    const packageId = req.params.id;
    const pkg = await packagesCollection.findOne({ _id: new ObjectId(packageId) });
    if (!pkg) return res.status(404).send({ message: "Package not found" });
    res.send(pkg);
  } catch (err) {
    res.status(500).send({ message: "Server error" });
  }
});


app.get("/assets", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;  
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const totalItems = await assetsCollection.countDocuments();
    const assets = await assetsCollection.find({}).skip(skip).limit(limit).toArray();

    res.send({
      page,
      totalPages: Math.ceil(totalItems / limit),
      totalItems,
      assets
    });
  } catch (err) {
    console.error(err);
    res.send({ success: false, message: "Failed to fetch assets" });
  }
});

app.get("/my-requests", async (req, res) => {
  const { email } = req.query;
  try {
    const requests = await requestsCollection.find({ requesterEmail: email }).toArray();
    res.send(requests);
  } catch (err) {
    res.status(500).send({ error: "Failed to fetch requests" });
  }
});
app.get("/hr/assets/:hrEmail", verifyJWT, verifyHR, async (req, res) => {
  try {
    const hrEmail = req.params.hrEmail;
    const assets = await assetsCollection.find({ hrEmail }).toArray();
    res.send({ success: true, assets });
  } catch (err) {
    console.error(err);
    res.status(500).send({ success: false, message: "Failed to fetch HR assets" });
  }
});



app.get("/team-members/:employeeEmail", async (req, res) => {
  try {
    const employeeEmail = req.params.employeeEmail;
    const employee = await usersCollection.findOne({ email: employeeEmail });
    if (!employee || !employee.assignedHR) {
      return res.send({ success: true, team: [] }); // no HR assigned
    }
    const hrEmail = employee.assignedHR;
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
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

  } catch (error) {
    console.log("Database Connection Failed:", error);
  }
}

startServer();