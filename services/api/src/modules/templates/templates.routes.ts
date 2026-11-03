import { Router } from "express";
import { validateRequest } from "../../middleware/validate-request.js";
import { createTemplateSchema } from "./templates.schema.js";

const router = Router();

router.post(
  "/",
  validateRequest(createTemplateSchema),
  (req, res) => {
    res.status(201).json({
      success: true,
      message: "Template request validated successfully",
      data: req.body,
    });
  }
);

export default router;