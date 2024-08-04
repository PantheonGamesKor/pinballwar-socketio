import { unix_time as unix_time_2 } from "../types_sock";
const { v4 } = require("uuid");

import dotenv from "dotenv";
dotenv.config();

export const REDIS_H = process.env.REDIS_H as string;
export const SERVER_NAME = process.env.SERVER_NAME as string;
export const EXTERNAL_URL = process.env.EXTERNAL_URL as string;

// 유니크 시작 번호
let unique_id = 0;

// me : 밀리초
export async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 고유번호 얻기2
export function make_uuid(): string {
  unique_id++;
  return v4() + "-" + unique_id;
}

export const unix_time = unix_time_2;

//
export function get_config() {
  return JSON.parse(process.env.CONFIG as string);
}
