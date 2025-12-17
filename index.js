const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const Stripe =require ("stripe");
const admin = require("firebase-admin")
const  { MongoClient,ServerApiVersion, ObjectId } = require("mongodb")
dotenv.config();




const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// MongoDB  connection
const client = new MongoClient(process.env.MONGO_URI);
const decoded = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString('utf8')
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

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



// async function updateMyAssets(db) {

//   const users = await usersCollection.find({}).toArray();

//   for (const user of users) {
//     if (user.myAssets && user.myAssets.length > 0) {
//       for (let i = 0; i < user.myAssets.length; i++) {
//         const assetId = user.myAssets[i].assetId;
//         const asset = await assetsCollection.findOne({ _id: new ObjectId(assetId) });
//         if (asset) {
//           await usersCollection.updateOne(
//             { _id: user._id, "myAssets.assetId": assetId },
//             {
//               $set: {
//                 "myAssets.$.assetName": asset.productName,
//                 "myAssets.$.assetType": asset.productType,
//                 "myAssets.$.assetImage": asset.productImage || "",
//                 "myAssets.$.companyName": asset.companyName || "",
//                 "myAssets.$.status": "approved",
//                 "myAssets.$.assignmentDate": asset.dateAdded
//               }
//             }
//           );
//         }
//       }
//     }
//   }
//   console.log("All myAssets updated successfully!");
// }


async function startServer() {
  try {
  
    console.log("MongoDB Connected");

    const db = client.db("assetverse");
    const usersCollection = db.collection("usersCollection");
     const packagesCollection = db.collection("packages");
     const assetsCollection = db.collection("assets")
      const requestsCollection = db.collection("requests")
      const assignedUsersCollection = db.collection("assignedUsers");
  

     // role middlewares
    const verifyHR = async (req, res, next) => {
      const email = req.tokenEmail
      const user = await usersCollection.findOne({ email })
      console.log(user)
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

app.post("/requests", verifyJWT, verifyEmployee, async (req, res) => {
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
    if (req.tokenEmail !== requesterEmail) {
      return res.status(403).send({
        success: false,
        message: "Unauthorized requester"
      });
    }

    if (!assetId || !requesterEmail || !hrEmail) {
      return res.status(400).send({
        success: false,
        message: "assetId, requesterEmail and hrEmail required"
      });
    }

    const requestDoc = {
      assetId: new ObjectId(assetId),
      assetName,
      assetType,
      requesterName,
      requesterEmail,
      hrEmail,
      companyName: companyName || "",
      note: note || "",
      requestDate: new Date(),
      approvalDate: null,
      requestStatus: "pending",
      processedBy: "",
    };

    const result = await requestsCollection.insertOne(requestDoc);

    res.send({
      success: true,
      requestId: result.insertedId,
    });
  } catch (err) {
    console.error("REQUEST CREATE ERROR:", err);
    res.status(500).send({
      success: false,
      message: "Failed to create request",
    });
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

    console.log(" HR email received:", hrEmail);
    const assets = await assetsCollection
      .find({ hrEmail })
      .toArray();

    console.log("Assets found:", assets.length);

    res.send(assets);

  } catch (err) {
    console.error("Error fetching assets:", err);
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

app.put("/users/:email", async (req, res) => {
  try {
    const email = req.params.email;
    const { name, photo } = req.body;

    const result = await usersCollection.updateOne(
      { email },
      { $set: { name, photo } }
    );

    const updatedUser = await usersCollection.findOne({ email });
    res.send({ success: true, user: updatedUser });
  } catch (err) {
    console.error(err);
    res.status(500).send({ success: false, message: "Failed to update user" });
  }
});

app.delete("/hr/remove-employee/:employeeEmail", verifyJWT, verifyHR, async (req, res) => {
  try {
    const hrEmail = req.tokenEmail;
    const employeeEmail = req.params.employeeEmail;
 const assignedResult = await assignedUsersCollection.deleteMany({
      hrEmail,
      employeeEmail
    });
    const user = await usersCollection.findOne({ email: employeeEmail });

    if (!user) {
      return res.status(404).send({ success: false, message: "Employee not found" });
    }

    if (user.assignedHR !== hrEmail) {
      return res.status(400).send({ success: false, message: "This employee is not assigned to you" });
    }
    await usersCollection.updateOne(
      { email: employeeEmail },
      { $unset: { assignedHR: "" } }
    );

    res.send({ 
      success: true, 
      message: "Employee removed successfully", 
      assignmentsRemoved: assignedResult.deletedCount 
    });

  } catch (err) {
    console.error("Remove employee error:", err);
    res.status(500).send({ success: false, message: "Server error" });
  }
});



app.get("/hr-requests/:hrEmail", verifyJWT, verifyHR, async (req, res) => {
  try {
    const hrEmail = req.params.hrEmail;
    if (req.tokenEmail !== hrEmail) {
      return res.status(403).send({
        success: false,
        message: "Forbidden: email mismatch"
      });
    }

    const requests = await requestsCollection
      .find({ hrEmail })
      .sort({ requestDate: -1 })
      .toArray();

    res.send({ success: true, requests });
  } catch (err) {
    console.error("HR REQUEST FETCH ERROR:", err);
    res.status(500).send({ success: false });
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
    let assetId;
    try {
      assetId = new ObjectId(request.assetId);
    } catch {
      return res.status(400).send({ success: false, message: "Invalid assetId in request" });
    }

    const asset = await assetsCollection.findOne({ _id: assetId });
    if (!asset) {
      return res.status(404).send({ success: false, message: "Asset not found" });
    }

    if (!asset.availableQuantity || asset.availableQuantity <= 0) {
      return res.status(400).send({ success: false, message: "Asset not available" });
    }


    const hr = await usersCollection.findOne({ email: request.hrEmail });
    const MAX_EMPLOYEES = hr?.employeeLimit || 5;

    const employeeCount = await usersCollection.countDocuments({ assignedHR: request.hrEmail });
    if (employeeCount >= MAX_EMPLOYEES) {
      return res.status(400).send({
        success: false,
        message: `Cannot approve. HR employee limit reached (${MAX_EMPLOYEES}).`
      });
    }

    const assetUpdate = await assetsCollection.updateOne(
      { _id: assetId, availableQuantity: { $gt: 0 } },
      { $inc: { availableQuantity: -1 } }
    );

    if (assetUpdate.modifiedCount === 0) {
      return res.status(400).send({ success: false, message: "Asset not available anymore" });
    }

    const approvalDate = new Date();

  
    await requestsCollection.updateOne(
      { _id: request._id },
      { $set: { requestStatus: "approved", approvalDate } }
    );

    const userUpdate = await usersCollection.updateOne(
      { email: request.requesterEmail },
      {
        $push: {
          myAssets: {
            assetId,
            assetName: asset.productName,
            assetType: asset.productType,
            assetImage: asset.productImage || "",
            companyName: asset.companyName || "",
            requestDate: request.requestDate,
            approvalDate,
            status: "approved"
          }
        },
        $set: { assignedHR: request.hrEmail, joinDate: new Date() }
      }
    );

    if (userUpdate.matchedCount === 0) {
      return res.status(404).send({ success: false, message: "Employee not found" });
    }

    await assignedUsersCollection.insertOne({
      hrEmail: request.hrEmail,
      employeeEmail: request.requesterEmail,
      employeeName: request.requesterName,
      companyName: request.companyName || "",
      assetName: asset.productName,
      assetId,
      assignedDate: approvalDate,
      createdAt: new Date(),
    });

    res.send({ success: true, message: "Request approved & assigned successfully!" });

  } catch (err) {
    console.error("APPROVE ERROR:", err);
    res.status(500).send({
      success: false,
      message: "Error approving request",
      error: err.message,
    });
  }
});



app.get("/returnable-assets", verifyJWT, verifyHR, async (req, res) => {
  try {
    const hrEmail = req.tokenEmail;

    const assets = await assetsCollection.find({ hrEmail }).toArray();

    let returnable = 0;
    let nonReturnable = 0;

    assets.forEach(asset => {
      if (
        asset.productType &&
        asset.productType.toLowerCase() === "returnable"
      ) {
        returnable++;
      } else {
        nonReturnable++;
      }
    });

    res.send([
      { name: "Returnable", value: returnable },
      { name: "Non-returnable", value: nonReturnable },
    ]);
  } catch (err) {
    console.error("RETURNABLE STATS ERROR:", err);
    res.status(500).send([]);
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

app.put("/assets/return/:id",verifyJWT,verifyEmployee, async (req, res) => {
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

    const employee = await usersCollection.findOne({ email });
    if (!employee) {
      return res.send({
        success: true,
        hrs: [],
        colleagues: [],
        company: "",
      });
    }

    const company = employee.companyName || "";
    const approvedRequests = await requestsCollection
      .find({ requesterEmail: email, requestStatus: "approved" })
      .project({ hrEmail: 1 })
      .toArray();

    const hrEmails = [...new Set(approvedRequests.map(r => r.hrEmail))];
    const hrs = await usersCollection
      .find({ email: { $in: hrEmails } })
      .project({
        name: 1,
        email: 1,
        companyLogo: 1,
        companyName: 1,
        position: 1,
      })
      .toArray();
    const colleagues = await usersCollection
      .find({ companyName: company, email: { $ne: email } })
      .project({
        name: 1,
        email: 1,
        photo: 1,
        position: 1,
        companyName: 1,
      })
      .toArray();

    res.send({
      success: true,
      hrs,
      colleagues,
      company,
    });
  } catch (err) {
    console.error("MY TEAM ERROR:", err);
    res.status(500).send({ success: false });
  }
});



app.get("/team-hrs/:employeeEmail", async (req, res) => {
  try {
    const employeeEmail = req.params.employeeEmail;

    const approvedRequests = await requestsCollection
      .find({ requesterEmail: employeeEmail, requestStatus: "approved" })
      .project({ hrEmail: 1 })
      .toArray();

    const hrEmails = [...new Set(approvedRequests.map((r) => r.hrEmail))];
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

app.post("/assigned-users", verifyJWT, verifyHR, async (req, res) => {
  try {
    const {
      hrEmail,
      employeeEmail,
      employeeName,
      companyName,
      assetName,
      assignedDate,
    } = req.body;

    if (!hrEmail || !employeeEmail || !assetName) {
      return res
        .status(400)
        .send({ success: false, message: "Required fields missing" });
    }

    const assignedData = {
      hrEmail,
      employeeEmail,
      employeeName,
      companyName,
      assetName,
      assignedDate: assignedDate ? new Date(assignedDate) : new Date(),
      createdAt: new Date(),
    };

    const result = await assignedUsersCollection.insertOne(assignedData);

    res.send({ success: true, result });
  } catch (error) {
    console.error("Insert Assigned User Error:", error);
    res
      .status(500)
      .send({ success: false, message: "Failed to assign user" });
  }
});



app.get("/upcoming-birthdays", async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) return res.status(400).send({ success: false, message: "Email is required" });

  
    const user = await usersCollection.findOne({ email });
    if (!user || !user.companyName) {
      return res.send({ success: true, birthdays: [] }); 
    }

    const companyName = user.companyName;
    const currentMonth = new Date().getMonth() + 1;
    const employees = await usersCollection
      .find({ companyName })
      .project({ name: 1, email: 1, dob: 1 })
      .toArray();

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
          packageId: 1,          
          packagePurchasedAt: 1 
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

app.get("/my-requests",verifyJWT,verifyEmployee, async (req, res) => {
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
    console.log(hrEmail)
    const assets = await assetsCollection.find({ hrEmail }).toArray();
    res.send({ success: true, assets });
  } catch (err) {
    console.error(err);
    res.status(500).send({ success: false, message: "Failed to fetch HR assets" });
  }
});
app.get( "/hr/team-members/:hrEmail",
  verifyJWT,
  verifyHR,
  async (req, res) => {
    try {
      const hrEmail = req.params.hrEmail;

      const hr = await usersCollection.findOne({ email: hrEmail });

      const employees = await usersCollection
        .find({ assignedHR: hrEmail })
        .project({
          name: 1,
          email: 1,
          photo: 1,
          myAssets: 1,
          joinDate: 1,
        })
        .toArray();

      const employeeList = employees.map((emp) => ({
        _id: emp._id,
        name: emp.name,
        email: emp.email,
        photo: emp.photo || "",
        joinDate: emp.joinDate || null,
        assetsCount: emp.myAssets?.length || 0,
      }));

      res.send({
        success: true,
        employees: employeeList,
        currentCount: employeeList.length,
        packageLimit: hr?.employeeLimit || 5,
      });
    } catch (err) {
      console.error(err);
      res.status(500).send({ success: false });
    }
  }
);


app.get("/top-assets", verifyJWT, verifyHR, async (req, res) => {
  try {
    const hrEmail = req.tokenEmail;

    const requests = await requestsCollection
      .find({ hrEmail })
      .toArray();

    const countMap = {};

    requests.forEach(req => {
      if (!req.assetName) return;
      countMap[req.assetName] = (countMap[req.assetName] || 0) + 1;
    });

    const topAssets = Object.entries(countMap)
      .map(([assetName, requests]) => ({
        assetName,
        requests,
      }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 5);

    res.send(topAssets);
  } catch (err) {
    console.error("TOP ASSETS ERROR:", err);
    res.status(500).send([]);
  }
});



app.get("/team-members/:employeeEmail", async (req, res) => {
  try {
    const employeeEmail = req.params.employeeEmail;
    const employee = await usersCollection.findOne({ email: employeeEmail });
    if (!employee || !employee.assignedHR) {
      return res.send({ success: true, team: [] }); 
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
  

  } catch (error) {
    console.log("Database Connection Failed:", error);
  }
}
  app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  app.get("/", (req, res) => {
      res.send("AssetVerse Backend Running");
    });

startServer();