require('dotenv').config();
const express = require('express');
const multer = require('multer');
const OpenAI = require('openai');
const cors = require('cors');
const adjudicate = require('./adjudicator'); // Ensure this is in the same folder

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.json());
app.use(cors());

app.post('/api/extract', upload.single('document'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }

        const fileBase64 = req.file.buffer.toString('base64');


        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { 
                    role: "system", 
                    content: "You are an insurance claims assistant. Analyze the provided document and return ONLY a valid JSON object. Extract: claim_id, total_amount, diagnosis, doctor_reg, treatment_date, submission_date, member_join_date, consultation_fee, policy_active (boolean), member_covered (boolean), hospital, documents_legible (boolean), pre_auth (boolean)." 
                },
                { 
                    role: "user", 
                    content: [
                        { type: "text", text: "Extract data from this document:" },
                        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${fileBase64}` } }
                    ]
                }
            ],
            response_format: { type: "json_object" }
        });

        const extractedData = JSON.parse(completion.choices[0].message.content);

        // 2. Decision Engine Phase
        const adjudicationResult = adjudicate(extractedData);

        // 3. Final Response
        res.json({
            status: "success",
            extracted: extractedData,
            adjudication: adjudicationResult
        });

    } catch (error) {
        console.error("Error processing claim:", error);
        res.status(500).json({ error: "Failed to process claim", details: error.message });
    }
});

function keepalive() {
    let i = 0;
    while(true){
    setInterval(() => {
        i = (i + 1) % 6;
        console.log("server is alive");
    }, 30000);
}
}

keepalive();
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));