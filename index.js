require('dotenv').config()
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;
app.use(express.json())
app.use(cors())




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster-1.q9lo2nm.mongodb.net/?retryWrites=true&w=majority&appName=Cluster-1`;


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();


        const jobCollection = client.db('careerDB').collection('jobsCollection');

        const applicationsCollection = client.db('careerDB').collection('applications');







        app.get('/jobs', async (req, res) => {
            console.log('getting started');
            const cursor = jobCollection.find();
            console.log('this is cursor', cursor)
            const result = await cursor.toArray();
            console.log('this is result', result)
            res.send(result);
        })

        app.get('/job/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await jobCollection.findOne(query);
            res.send(result);
        })


        // application data management

        app.post('/application', async (req, res) => {
            const application = req.body;
            const result = await applicationsCollection.insertOne(application);
            res.send(result);
        })

        app.get('/application', async(req, res)=> {
            const email = req.query.email;
            const query = {
                userEmail : email
            }
            const result = await applicationsCollection.find(query).toArray();

            for(const application of result) {
                const jobId = application.jobId;
                const jobQuery = {_id: new ObjectId(jobId)};
                const job = await jobCollection.findOne(jobQuery);
                application.company = job.company;
                application.title=job.title;
                application.company_logo= job.company_logo;
                application.location = job.location;
                application.salaryRange = job.salaryRange;
            }


            res.send(result);
        })

        app.delete('/application/:id', async(req,res)=> {
            const id = req.params.id;
            const query = {_id: new ObjectId(id)};
            const result = await applicationsCollection.deleteOne(query);
            res.send(result);
        })



        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('career code server is cooking');
})

app.listen(port, () => {
    console.log(`server is running on port ${port}`)
})