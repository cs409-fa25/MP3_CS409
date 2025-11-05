

var express = require('express'),
    router = express.Router(),
    mongoose = require('mongoose'),
    bodyParser = require('body-parser');

require('dotenv').config();

var app = express();

app.get("/health", (req, res) => {
  res.status(200).json({ message: "OK", data: null });
});

app.get("/health/db", (req, res) => {
  const state = mongoose.connection.readyState;
  res.status(200).json({ message: "OK", data: { connected: state === 1, readyState: state } });
});

var port = process.env.PORT || 3000;

mongoose.set("strictQuery", true);
mongoose
  .connect(process.env.MONGODB_URI, { dbName: "llama" })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  });

var allowCrossDomain = function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept");
    res.header("Access-Control-Allow-Methods", "POST, GET, PUT, DELETE, OPTIONS");
    next();
};
app.use(allowCrossDomain);

app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());

require("./models/User");
require("./models/Task");

require('./routes')(app, router);

app.listen(port);
console.log('Server running on port ' + port);
