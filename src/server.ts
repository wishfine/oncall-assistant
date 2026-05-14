import app from "./app";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.listen(PORT, () => {
  console.log(`oncall-assistant listening on port ${PORT}`);
});
