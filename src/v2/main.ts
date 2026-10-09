import "./style.css";
import { boot } from "./app";

boot({ loadEngine: async () => (await import("./engine/engine")).Engine });
