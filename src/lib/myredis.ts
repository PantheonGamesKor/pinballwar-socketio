import Redis from "ioredis";
import {
  //
  REDIS_H,
  sleep,
  make_uuid,
  unix_time,
  get_config,
} from "./helper";

var is_init = false;
var redis = {} as Redis;

export async function init() {
  if (is_init) return;
  is_init = true;

  const CONFIG = get_config().myredis;
  console.log("myredis init start");

  const setting: any = {
    host: CONFIG.host,
    port: CONFIG.port,
    commandTimeout: 1000,
  };

  if (CONFIG.pass != "") {
    setting.password = CONFIG.pass;
  }

  // console.log("redis setting", setting);

  redis = new Redis(setting);
  redis.on("error", (err: any) => {
    console.log("redis error", err);
  });

  // console.log("myredis init ok");

  // 테스트 쿼리
  try {
    console.log("myredis init test query, starta");
    const data = await get_redis().get("a");
    console.log("myredis init test query, ok ret=", data);
  } catch (e) {
    console.log("myredis init test query, ng error=", e);
  }
}

export function get_redis() {
  if (!is_init) {
    init();
  }

  return redis;
}

export async function test() {
  console.log("redis test start");
  var a: any = null;

  a = await get_redis().del("a");
  console.log("del a", a);

  while (true) {
    await sleep(1000);

    try {
      await get_redis().set("a", "a");
      a = await get_redis().get("a");
      console.log("set a", a);
      await get_redis().expire("a", 1); // 초단위

      await sleep(1000 * 5);
      a = await get_redis().get("a");
      console.log("get a", a);
    } catch (e) {
      console.log("catch", e);
    }
  }
}
// test();

export interface TokenData {
  user_uid: number;
  user_name: string;
  team: number;
  profile_url: string;
  country: string;
  start_ch: number;
  Tinggo_level: number;
  Firo_level: number;
  Lighden_level: number;
  Icing_level: number;
  Windy_level: number;
}

export async function set_token(data: TokenData): Promise<Promise<string>> {
  const token = "TK-" + make_uuid();
  const key = redis_key(token);
  await get_redis().set(key, JSON.stringify(data));

  var d = unix_time();
  await get_redis().expireat(key, d + 60);

  return token;
}

export async function get_token(token: string): Promise<TokenData | null> {
  const key = redis_key(token);
  const text = await get_redis().get(key);
  if (text === null) return null;

  // 한번쓰고 버림
  await get_redis().del(key);

  var data = JSON.parse(text) as TokenData;
  return data;
}

export function redis_key(key: string) {
  const key2 = `${REDIS_H}:${key}`;
  return key2;
}
