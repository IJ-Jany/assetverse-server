import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";

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

  

    // Start server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

  } catch (error) {
    console.log("Database Connection Failed:", error);
  }
}

startServer();
