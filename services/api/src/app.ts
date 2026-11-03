import express from "express";
import cors from "cors";
import helmet from "helmet";
import templatesRouter from "./modules/templates/templates.routes.js";

const app = express();

// Security middleware
app.use(helmet());

// Allow cross-origin requests
app.use(cors());

// Parse incoming JSON data
app.use(express.json());

// Health check route
app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Frontend Studio API is running",
  });
});
//templates routes
app.use("/api/templates", templatesRouter);
export default app;
