import { Server } from "colyseus";
import { BattleRoom } from "./BattleRoom.ts";

const port = Number(process.env.PORT ?? 2567);
const gameServer = new Server();

gameServer.define("battle", BattleRoom);
gameServer.listen(port, "0.0.0.0").then(() => {
  console.log(`炸彈超人伺服器啟動：ws://localhost:${port}`);
});
