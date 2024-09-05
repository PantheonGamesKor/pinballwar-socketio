// index.js
const { app, init_socket_io } = require("./dist/app");
// require("ts-node").register();
// const { app, init_socket_io } = require("./src/app.ts");

const http = require("http");
const server = http.createServer(app);
const PORT = 3000;

init_socket_io(server);

server.listen(PORT, () => {
  console.log("listening on *:" + PORT);
});
