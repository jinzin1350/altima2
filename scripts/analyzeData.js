import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { analyzeDataStructure } from '../server/services/openai.js';

dotenv.config();

/**
 * Analyze HTML files and generate recommendations
 */
async function analyzeData() {
  try {
    console.log('🔍 Starting data analysis...\n');

    // File paths to analyze
    const filePaths = [
      '/mnt/user-data/uploads/messages42.html',
      '/mnt/user-data/uploads/messages43.html',
    ];

    // Try to read sample HTML file
    let htmlSample = '';
    let fileFound = false;

    for (const filePath of filePaths) {
      try {
        console.log(`Attempting to read: ${filePath}`);
        const content = await fs.readFile(filePath, 'utf-8');
        // Get first 5000 characters as sample
        htmlSample = content.substring(0, 5000);
        fileFound = true;
        console.log(`✅ Successfully read ${filePath}\n`);
        break;
      } catch (error) {
        console.log(`⚠️  Could not read ${filePath}: ${error.message}`);
      }
    }

    if (!fileFound) {
      console.log('\n⚠️  No HTML files found at specified paths.');
      console.log('Using sample data structure for analysis...\n');

      // Use sample HTML structure for analysis
      htmlSample = `
        <html>
        <body>
          <table>
            <tr bgcolor="#ff0000">
              <td>2024-01-15 10:30:00</td>
              <td>PROBLEM</td>
              <td>Router-01</td>
              <td>Interface GigabitEthernet0/0/1 is down</td>
              <td>Problem ID: 12345</td>
              <td>Severity: HIGH</td>
              <td>Duration: 2h 15m</td>
            </tr>
            <tr bgcolor="#00ff00">
              <td>2024-01-15 12:45:00</td>
              <td>OK</td>
              <td>Router-01</td>
              <td>Interface GigabitEthernet0/0/1 is up</td>
              <td>Problem ID: 12345</td>
            </tr>
          </table>
        </body>
        </html>
      `;
    }

    console.log('📊 Sending sample to GPT-4o-mini for analysis...\n');

    // Analyze with AI
    const analysis = await analyzeDataStructure(htmlSample);

    console.log('✅ Analysis complete!\n');

    // Save analysis to file
    const outputPath = path.join(process.cwd(), 'data-analysis-report.json');
    await fs.writeFile(outputPath, JSON.stringify(analysis, null, 2));

    console.log(`📁 Analysis saved to: ${outputPath}\n`);

    // Display summary
    console.log('═══════════════════════════════════════════════════');
    console.log('                 ANALYSIS SUMMARY                  ');
    console.log('═══════════════════════════════════════════════════\n');

    if (analysis.dataFields) {
      console.log('📋 DATA FIELDS IDENTIFIED:');
      analysis.dataFields.forEach((field, index) => {
        const useful = field.useful ? '✓' : '✗';
        console.log(`  ${index + 1}. [${useful}] ${field.name}: ${field.description}`);
      });
      console.log('');
    }

    if (analysis.databaseSchema) {
      console.log('🗄️  DATABASE SCHEMA RECOMMENDATION:');
      console.log(JSON.stringify(analysis.databaseSchema, null, 2));
      console.log('');
    }

    if (analysis.embeddingStrategy) {
      console.log('🔍 EMBEDDING STRATEGY:');
      console.log(analysis.embeddingStrategy);
      console.log('');
    }

    if (analysis.exampleQuestions) {
      console.log('💬 EXAMPLE QUESTIONS:');
      analysis.exampleQuestions.forEach((q, index) => {
        console.log(`  ${index + 1}. ${q}`);
      });
      console.log('');
    }

    console.log('═══════════════════════════════════════════════════');
    console.log('\n✨ Next steps:');
    console.log('  1. Review the analysis in data-analysis-report.json');
    console.log('  2. Set up your Supabase database with the recommended schema');
    console.log('  3. Run: npm run setup (to create tables and upload data)');
    console.log('  4. Run: npm run dev (to start the application)\n');
  } catch (error) {
    console.error('❌ Error during analysis:', error);
    process.exit(1);
  }
}

// Run analysis
analyzeData();
