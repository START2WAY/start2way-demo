const fs = require('fs');
const path = require('path');
const getUserAuth = require('../../shared/auth/getUserAuth');
const getFleetVehicle = require('../getFleetVehicle');
const dal = require('../../dal');

const FleetAIService = {
  getSystemPrompt() {
    try {
      const agentsDir = path.join(__dirname, '..', 'agent');
      const identity = fs.readFileSync(path.join(agentsDir, 'IDENTITY.md'), 'utf-8');
      const scope = fs.readFileSync(path.join(agentsDir, 'SCOPE.md'), 'utf-8');
      const dataAccess = fs.readFileSync(path.join(agentsDir, 'DATA_ACCESS.md'), 'utf-8');
      
      let emailRules = '';
      try {
        emailRules = fs.readFileSync(path.join(agentsDir, 'EMAIL_RULES.md'), 'utf-8');
      } catch(e) {}
      
      let safety = '';
      try {
        safety = fs.readFileSync(path.join(agentsDir, 'SAFETY.md'), 'utf-8');
      } catch(e) {}

      return `${identity}\n\n${scope}\n\n${dataAccess}\n\n${emailRules}\n\n${safety}`;
    } catch (e) {
      console.warn('Failed to load AI config from .md files:', e);
      return "Tu es l'Assistant Flotte de START2WAY. Tu ne dois jamais inventer d'informations. Tu ne peux faire que de la LECTURE.";
    }
  },

  async handleChat(req, res) {
    try {
      const auth = await getUserAuth(req);
      if (!auth) return res.status(401).json({ error: 'UNAUTHORIZED' });

      // FORCE COMPANY ID FROM AUTHENTICATION - NO CLIENT TRUST
      const company_id = auth.company_id; 
      
      const { message, history, vehicle_id } = req.body;
      
      if (!company_id || !vehicle_id) {
        return res.status(400).json({ error: 'Missing company_id or vehicle_id context' });
      }

      // 1. Get vehicle data and verify company isolation strictly
      const vehicle = getFleetVehicle(company_id, vehicle_id);
      if (!vehicle) {
        return res.status(403).json({ error: 'Vehicle not found or cross-company access denied' });
      }

      // Format vehicle context
      const vehicleContext = `
Contexte du véhicule sélectionné (STRICTEMENT RÉEL) :
- ID: ${vehicle.id || 'N/A'}
- Immatriculation : ${vehicle.plate_number || 'Non renseignée'}
- Marque/Modèle : ${vehicle.brand || ''} ${vehicle.model || ''}
- VIN : ${vehicle.vin || 'Non renseigné'}
- Kilométrage initial entreprise : ${vehicle.initial_company_odometer || 'Inconnu'} km
- Kilométrage actuel : ${vehicle.last_known_km || 'Inconnu'} km
- Date CT : ${vehicle.technical_inspection_date || 'Inconnue'} (Expire le ${vehicle.technical_inspection_expiry_date || 'Inconnue'})
- Assurance : Du ${vehicle.insurance_start_date || 'Inconnue'} au ${vehicle.insurance_expiry_date || 'Inconnue'}
- En location : ${vehicle.is_leased ? 'OUI (' + (vehicle.lessor_name || '') + ')' : 'NON'}

Historique de maintenance récent :
${(vehicle.maintenance_history || []).slice(-3).map(m => `- ${m.date}: ${m.type} à ${m.odometer}km (${m.description || ''})`).join('\n')}

IMPORTANT : Si l'utilisateur demande à rédiger un email, réponds TOUJOURS en terminant par :
"Voici l'e-mail que vous pouvez envoyer avec votre propre service de messagerie."
Suivi du brouillon avec "Objet : ..." et "Message : ...".
`;

      const systemPrompt = FleetAIService.getSystemPrompt() + '\n\n' + vehicleContext;

      // 3. Call Cloud AI API 
      const apiKey = process.env.FLEET_AI_API_KEY;
      if (!apiKey) {
        // En prod, si la clé est absente, on ne fake pas le succès
        return res.status(503).json({ error: 'AI_KEY_MISSING' });
      }

      const messages = [
        { role: 'system', content: systemPrompt },
        ...(history || []).map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: message }
      ];

      const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: messages,
          temperature: 0.2
        })
      });

      if (!aiRes.ok) {
        throw new Error('AI Provider error');
      }

      const aiData = await aiRes.json();
      const aiReply = aiData.choices[0].message.content;

      // 4. Audit Log
      dal.changelog.insert(docEnt.id, `upload_doc_${docEnt.id}_${Date.now()}`, 'documents', documentId, 'UPDATE', payload.version, new Date().toISOString(), auth.role === 'company' ? 'COMPANY' : 'USER', auth.company_id || auth.user_id, null, payload.company_id, JSON.stringify(payload));

      return res.json({ reply: aiReply });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'AI Assistant temporarily unavailable' });
    }
  }
};

module.exports = FleetAIService;
