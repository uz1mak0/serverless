var mgs = require("merge-graphql-schemas");
var fileLoader = mgs.fileLoader;
var mergeTypes = mgs.mergeTypes;

var path = require("path");
var fs = require("fs");
const FILENAME = "./schema.graphql";

//delete the existing schema.graphql if it is existed
fs.unlink(FILENAME, function (err) {});
//loads all graphQL schema files
var typesArray = fileLoader(path.join(__dirname, "./**/*.graphql"), {
  recursive: true,
});
//merges all the schemas
var typeDefs = mergeTypes(typesArray, { all: true });
//write the merged schema into a file
fs.writeFileSync(FILENAME, typeDefs);

module.exports = typeDefs;