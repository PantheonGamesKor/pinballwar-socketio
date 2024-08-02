import { app, init_socket_io } from "./src/app";
import http from "http";

const server = http.createServer(app);
const PORT = 3000;

init_socket_io(server);

server.listen(PORT, () => {
  console.log("listening on *:" + PORT);
});
