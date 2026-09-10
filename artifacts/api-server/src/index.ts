import app from "./app";

const port = Number(process.env.PORT) || 10000;

app.listen(port, "0.0.0.0", () => {
  console.log(`Faroh IA API running on port ${port}`);
});