require('dotenv').config()
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;
app.use(express.json())
app.use(cors({
    origin: ['http://localhost:5173'],
    credentials: true
}))

app.use(cookieParser());

const jwt = require('jsonwebtoken');


//firebase admin
var admin = require("firebase-admin");

var serviceAccount = require("./firebase-admin-key.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});


const logger = (req, res, next) => {
    // console.log('from logger');
    next();
}

const verifyToken = (req, res, next) => {
    const token = req.cookies.token;
    // console.log('cookie from middleware', token);

    //return unauthorized access request if the token is missing!

    if (!token) {
        return res.status(401).send({ message: 'unauthorized access' });
    }

    //verify the token
    jwt.verify(token, process.env.ACCESS_SECRET, (err, decoded) => {
        if (err) {
            res.status(401).send({ message: 'unauthorized access' })
        }
        req.decoded = decoded;
        // console.log(decoded.email);
        next();
    })
}

const verifyFirebaseToken = async (req, res, next) => {
    // console.log(req?.headers?.authorization);

    const firebaseToken = req?.headers?.authorization;
    // console.log('token of firebase', firebaseToken)

    if (!firebaseToken || !firebaseToken.startsWith('Bearer')) {
        return res.status(401).send({ message: 'unauthorized access' });
    }

    const token = firebaseToken.split(' ')[1];

    if (!token) {
        res.status(401).send({ message: 'unauthorized access' });
    }

    try {
        const userInfo = await admin.auth().verifyIdToken(token);
        // console.log(userInfo);
        req.tokenEmail = userInfo?.email;
        next()
    }
    catch (err) {
        res.status(401).send('unauthorized access');
    }

}



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





        // jobs data management

        app.get('/jobs', async (req, res) => {

            const email = req.query.email;

            let query = {};

            if (email) {
                query.hr_email = email;
            }

            const cursor = jobCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        })

        app.get('/job/applications', verifyFirebaseToken, async (req, res) => {
            const email = req.query.email;

            const cookieEmail = req?.tokenEmail;
            // console.log(cookieEmail);

            if (email !== cookieEmail) {
                res.status(403).send('forbidden access');
            }

            const query = { hr_email: email };
            const jobs = await jobCollection.find(query).toArray();

            for (const job of jobs) {
                const applicationQuery = { jobId: job._id.toString() };
                const applicationCount = await applicationsCollection.countDocuments(applicationQuery);
                job.applicationCount = applicationCount;
            }

            res.send(jobs);
        })

        app.get('/job/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await jobCollection.findOne(query);
            res.send(result);
        })

        app.post('/jobs', async (req, res) => {
            const job = req.body;
            const result = await jobCollection.insertOne(job);
            res.send(result);
        })


        //jwt tokens

        app.post('/jwt', async (req, res) => {
            // const { email } = req.body;
            // const user = { email };
            const user = { email: req.body?.userData?.email };
            // console.log('from jwt',user);
            const token = jwt.sign(user, process.env.ACCESS_SECRET, { expiresIn: '1h' });

            res.cookie('token', token, {
                httpOnly: true,
                secure: false
            })

            res.send({ success: true });
        })


        // application data management

        app.post('/application', async (req, res) => {
            const application = req.body;
            const result = await applicationsCollection.insertOne(application);
            res.send(result);
        })

        app.get('/application', logger, verifyFirebaseToken, async (req, res) => {
            const email = req.query.email;

            const cookieEmail = req?.tokenEmail;
            // console.log(cookieEmail);

            if (email !== cookieEmail) {
                res.status(403).send('forbidden access');
            }

            const query = {
                userEmail: email
            }
            const result = await applicationsCollection.find(query).toArray();

            // console.log('from back', req.cookies)


            for (const application of result) {
                const jobId = application.jobId;
                const jobQuery = { _id: new ObjectId(jobId) };
                const job = await jobCollection.findOne(jobQuery);
                application.company = job.company;
                application.title = job.title;
                application.company_logo = job.company_logo;
                application.location = job.location;
                application.salaryRange = job.salaryRange;
            }


            res.send(result);
        });

        app.get('/applications/job/:job_id', async (req, res) => {
            const job_id = req.params.job_id;
            const query = { jobId: job_id };
            const result = await applicationsCollection.find(query).toArray();
            res.send(result);
        })

        app.patch('/applications/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: req.body
            }
            // const options = { upsert: true };
            const result = await applicationsCollection.updateOne(filter, updatedDoc)
            res.send(result);
        })

        app.delete('/application/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
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