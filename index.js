import express from 'express';
import {GoogleGenAI} from '@google/genai';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
// --- This import now works perfectly because of "type": "module" ---
import pdfParse from 'pdf-parse-new'


// --- SETUP ---
dotenv.config(); // Load API key from .env file
const app = express();
const port = process.env.PORT || 5000;
app.use(cors()); // Allow requests from your React app
app.use(express.json());



// Set up Multer for file upload
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Initialize Google AI
const genAI = new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY});

// --- "MAGIC PROMPT" AND SCHEMA ---
const systemPrompt = `You are a strict, expert resume parsing assistant. Your *only* job is to extract data and format it *exactly* according to the provided JSON schema.

- **Important Rules**:
    - Do not invent information. If a field is not found, return an empty string "" for strings or an empty array [] for arrays.
    - Your response *must* be a valid JSON object. Do not include markdown \`\`\`json \`\`\` or any other text.
    - Be very precise. Do not merge unrelated sections.

- **Field-by-Field Instructions**:
    - **basics.summary**: **This is ONLY for the 1-2 sentence professional summary.** It *MUST* end before the 'Technical Skills' or 'Experience' section. **DO NOT** include skills, projects, or experience in this field.
    - **skills**: Find the "Skills" section and list all technical skills.
    - **projects**:
        - Find the "Projects" section.
        - \`name\`: The project's title.
        - \`description\`: The bullet points or paragraph *describing* the project.
        - \`technologies\`: The list of technologies used (e.g., "React.js", "Node.js").
        - \`url\`: **ONLY populate this if you see a full, explicit URL** (e.g., "github.com/user/repo"). If you only see link *text* like "Live Demo" or "GitHub", leave this field as an empty string \`""\`.
  
    - **experience**: should be a list of professional work experiences, including role, company, duration, and description.
- **achievements**:should be a list of awards, certifications, or key achievements.
    - **education**: Extract all education history into this array.
    - **otherSections**: This is for *everything else* not covered above, such as "Achievements", "Certifications", or "Publications".`;

// --- (UPDATED SCHEMA) ---
const schema = {
  type: "OBJECT",
  properties: {
    "basics": {
      type: "OBJECT",
      properties: {
        "name": { type: "STRING" },
        "label": { type: "STRING" },
        "email": { type: "STRING" },
        "linkedin": { type: "STRING" },
        "github": { type: "STRING" },
        "summary": { type: "STRING" }
      }
    },
    "skills": {
      type: "ARRAY",
      items: { type: "OBJECT", properties: { "name": { type: "STRING" } } }
    },
    "projects": {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          "name": { type: "STRING" },
          "description": { type: "STRING" },
          "technologies": { type: "ARRAY", items: { type: "STRING" } },
          "url": { type: "STRING" }
        }
      }
    },
    "experience": {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          "role": { type: "STRING" },
          "company": { type: "STRING" },
          "date": { type: "STRING" },
          "description": { type: "STRING" }
        }
      }
    },
    "education": {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          "institution": { type: "STRING" },
          "degree": { type: "STRING" },
          "date": { type: "STRING" }
        }
      }
    },
   

    "achievements": {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          "description": { type: "STRING" }
        }
      }
    },
    "otherSections": {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          "title": { type: "STRING" },
          "content": { type: "STRING" }
        }
      }
    }
  }
};

// --- THE API ENDPOINT ---
app.post('/api/parse-resume', upload.single('resume'), async (req, res) => {
 console.log('Received a file to parse...');

 if (!req.file) {
 return res.status(400).json({ error: 'No resume file uploaded.' });
 }

 try {
 // 1. Read the PDF text from the uploaded file buffer
 const pdfData = await pdfParse(req.file.buffer);
 const resumeText = pdfData.text;
// console.log(resumeText)
    // 2. Call the Google AI API (New Stateless Format)
    const response = await genAI.models.generateContent({
      model: "gemini-pro-latest",
      systemInstruction: systemPrompt,
      contents: [{ role: "user", parts: [{ text: resumeText }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

//  const response = result.response;
 console.log(response)
 console.log(response.text)
 const parsedJson = JSON.parse(response.text);

 console.log('Successfully parsed resume!');
 
 // 3. Send the clean JSON data back to the React app
 res.json(parsedJson);

 } catch (error) {
 console.error('Error in /api/parse-resume:', error);
 res.status(500).json({ error: 'Failed to parse resume.', details: error.message });
 }
});

app.listen(port, () => {
 console.log(`🚀 Server running on https://r2p.onrender.com`);
});