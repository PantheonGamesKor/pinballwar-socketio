// app.ts
import express from "express";
import {
  //
  on_connection,
  on_update_client,
  on_update_waitroot,
} from "./ws";
import { HttpServer2, WSServer } from "./types_sock";
import { DummyClient, create_dummy, create_fake_user } from "./lib/DummyClient";
import {
  //
  REDIS_H,
  IS_DEV,
} from "./lib/helper";

export const app = express();
// const server: HTTP_SERVER = http.createServer(app);

app.get("/", (_req, res) => {
  res.send("ok");
});

app.get("/", (_req, res) => {
  res.send("ok");
});

let update_count = 0;
const start_dummy_count = 40; // 4팀은 돌려야해서
export function init_socket_io(server: HttpServer2) {
  console.log("init_socket_io start");

  const io = new WSServer(server);
  io.on("connection", on_connection);

  // 자주 업데이트
  setInterval(() => {
    update_count++;
    if (update_count % 5 == 0) {
      // 접속자 업데이트
      on_update_client();
    }
    if (update_count % 3 == 0) {
      // 대기방 업데이트
      on_update_waitroot();
    }
  }, 1000);

  if (IS_DEV) {
    // 유저같은 더미 생성
    create_fake_user();
  }

  // dummy 생성
  for (var i = 0; i < start_dummy_count; i++) {
    create_dummy();
  }
}
