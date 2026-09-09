class CircuitAgentWrapper {
  static async auditInput(rawRows, method) {
    if (!process.env.CIRCUIT_OPENAI_API_KEY) {
      return { status: 'PROVIDER_NOT_CONFIGURED', error: 'LIVE PROVIDER CONFIGURATION PENDING' };
    }

    try {
      const systemPrompt = 'You are a quality control assistant for a logistics route planning system. You will receive raw address rows and must identify potential issues (incomplete addresses, suspected duplicates, invalid formats) WITHOUT correcting them. Respond ONLY with a valid JSON object in this exact format: {"status":"OK","issues":[{"rowIndex":<integer>,"severity":"warning"|"error","message":"<string>"}]}. The issues array may be empty if no problems are found. Do not include any text outside the JSON object.';

      const userPrompt = JSON.stringify({
        rows: rawRows,
        input_method: method
      });

      const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CIRCUIT_OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.2
        })
      });

      if (!aiRes.ok) {
        const errText = await aiRes.text();

        return {
          status: 'FAILED',
          error: `OpenAI API HTTP ${aiRes.status}: ${errText}`
        };
      }

      const aiData = await aiRes.json();

      const rawContent =
        aiData.choices &&
        aiData.choices[0] &&
        aiData.choices[0].message &&
        aiData.choices[0].message.content;

      let parsed;

      try {
        parsed = JSON.parse(rawContent);
      } catch (parseErr) {
        return {
          status: 'FAILED',
          error: 'Invalid AI response format'
        };
      }

      const isValidIssue = (issue) =>
        issue &&
        typeof issue.rowIndex === 'number' &&
        Number.isInteger(issue.rowIndex) &&
        issue.rowIndex >= 0 &&
        (issue.severity === 'warning' || issue.severity === 'error') &&
        typeof issue.message === 'string' &&
        issue.message.length > 0;

      if (
        !parsed ||
        parsed.status !== 'OK' ||
        !Array.isArray(parsed.issues) ||
        !parsed.issues.every(isValidIssue)
      ) {
        return {
          status: 'FAILED',
          error: 'Invalid AI response format'
        };
      }

      return {
        status: 'OK',
        issues: parsed.issues
      };
    } catch (err) {
      return {
        status: 'FAILED',
        error: err.message
      };
    }
  }
  
  static async auditOptimization(stops, optimizedOrder) {
    if (!process.env.CIRCUIT_AI_PROVIDER) {
      return { status: 'PROVIDER_NOT_CONFIGURED', error: 'LIVE PROVIDER CONFIGURATION PENDING' };
    }
    // TODO: Call LLM
    return { status: 'FAILED', error: 'Not implemented yet' };
  }
}
module.exports = CircuitAgentWrapper;
