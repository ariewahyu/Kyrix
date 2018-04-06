// imports
const fs = require("fs");
const mysql = require("mysql");
const Canvas = require("./Canvas").Canvas;
const Jump = require("./Jump").Jump;
const Layer = require("./Layer").Layer;
const Transform = require("./Transform").Transform;

/**
 *
 * @param {string} name - project name.
 * @param {string} dbFile - a configuration file for the database this project is associated with. This file contains a json blob specifying the host, user, and password of the database (see dbconfig.example for an example). NEVER check this file into the repo. 'dbconfig.txt' is added to gitignore, so it'll be convenient to name it as 'dbconfig.txt'. Note that if relative path is used, the path is relative to the directory the Kyrix spec is run in.
 * @param {number} viewportWidth - the width of the viewport, in pixels.
 * @param {number} viewportHeight - the height of the viewport, in pixels.
 * @constructor
 */
function Project(name, dbFile, viewportWidth, viewportHeight) {
    // name
    this.name = name;

    // db configs
    this.dbConfig = JSON.parse(fs.readFileSync(dbFile));

    // viewport
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;

    // the set of canvases
    this.canvases = [];

    // the set of jump transitions
    this.jumps = [];

    // initial viewport, canvas
    this.initialCanvasId = "";
    this.initialViewportX = 0;
    this.initialViewportY = 0;
}

/**
 * Add a canvas to a project.
 */
function addCanvas(canvas) {

    // check whether id is used
    for (var i = 0; i < this.canvases.length; i ++)
        if (this.canvases[i].id == canvas.id)
            throw new Error("Constructing canvas: id " + canvas.id + " already existed.");

    // add this canvas to the canvas array
    this.canvases.push(canvas);
}

/**
 * Add a Jump to a project.
 */
function addJump(jump) {

    // check whether sourceID exists
    var exist = false;
    for (var i = 0; i < this.canvases.length; i ++)
        if (this.canvases[i].id === jump.sourceId)
            exist = true;
    if (! exist)
        throw new Error("Constructing Jump: canvas " + jump.sourceId + " does not exist.");

    // check whether destId exists
    exist = false;
    for (var i = 0; i < this.canvases.length; i ++)
        if (this.canvases[i].id === jump.destId)
            exist = true;
    if (! exist)
        throw new Error("Constructing Jump: canvas " + jump.destId + " does not exist.");

    // check whether newViewports & newpredicates have the same number of elements as the # of layers in sourceId
    for (var i = 0; i < this.canvases.length; i ++)
        if (this.canvases[i].id === jump.sourceId)
            if (jump.newViewports.length != this.canvases[i].layers.length ||
                jump.newPredicates.length != this.canvases[i].layers.length)
                throw new Error ("Constructing Jump: wrong number of newViewport/newPredicates functions.");

    this.jumps.push(jump);
}

/**
 * Set the initial canvas and viewport for a project
 * @param {string} id - the id of the canvas
 * @param {number} viewportX - x coordinate of the initial viewport (top left)
 * @param {number} viewportY - y coordinate of the initial viewport (top left)
 * @param {array} predicates - the initial predicates to be added to the sql query of data transforms
 */
function initialCanvas(id, viewportX, viewportY, predicates) {

    // check if this id exists
    var canvasId = -1;
    for (var i = 0; i < this.canvases.length; i ++)
        if (this.canvases[i].id === id)
            canvasId = i;
    if (canvasId == -1)
        throw new Error("Initial canvas: canvas " + id + " does not exist.");

    // check viewport range
    if (viewportX < 0 || viewportX > this.viewportWidth)
        throw new Error("Initial canvas: viewportX out of range.");
    if (viewportY < 0 || viewportY > this.viewportHeight)
        throw new Error("Initial canvas: viewportY out of range.");

    // check if the size of the predicates array equals the number of layers
    if (predicates.length != this.canvases[canvasId].layers.length)
        throw new Error("Initial canvas: # predicates does not equal # layers.");

    // assign fields
    this.initialCanvasId = id;
    this.initialViewportX = viewportX;
    this.initialViewportY = viewportY;
    this.initialPredicates = predicates;
}

// save the current to project to the database it's associated with
function saveToDb()
{

    // connecting with mysql
    var dbConn = mysql.createConnection({
        host     : this.dbConfig.host,
        user     : this.dbConfig.user,
        password : this.dbConfig.password
    });
    dbConn.connect(function(err) {
        if (err) {
            console.error('error connecting: ' + err.stack);
            return;
        }
        console.log('connected as id ' + dbConn.threadId);
    });

    // create the database 'Kyrix' and ignore the error
    dbConn.query("CREATE DATABASE Kyrix;", function (err) {});

    // use the database
    dbConn.query("USE Kyrix;", function (err) {
        if (err) throw err;
    });

    // create a table and ignore the error
    var createTableQuery = "CREATE TABLE project (name VARCHAR(255), content TEXT" +
        ", CONSTRAINT PK_project PRIMARY KEY (name));";
    dbConn.query(createTableQuery, function (err) {});

    // turn the current project into a json blob
    var projectJSON = JSON.stringify(this, function (key, value) {
        if (typeof value === 'function')
            return value.toString();
        return value;
    });
    var logJSON = JSON.stringify(this, function (key, value) {
        if (typeof value === 'function')
            return value.toString();
        return value;
    }, 4);
    console.log(logJSON);

    // add escape character to projectJSON
    projectJSON = (projectJSON + '').replace(/[\\"']/g, '\\$&').replace(/\u0000/g, '\\0');
//    console.log(projectJSON);

    // insert the JSON blob into the project table
    var insertQuery = "INSERT INTO project (name, content) VALUES (\'" +
        this.name + "\', \'" + projectJSON + "\');"
    dbConn.query(insertQuery,
        function (err) {
            if (err) throw err;
        });

    dbConn.end();
}

// define prototype functions
Project.prototype = {
    addCanvas: addCanvas,
    addJump: addJump,
    initialCanvas: initialCanvas,
    saveToDb: saveToDb
};

// exports
module.exports = {
    Project : Project,
    Canvas : Canvas,
    Jump : Jump,
    Layer : Layer,
    Transform : Transform
};
