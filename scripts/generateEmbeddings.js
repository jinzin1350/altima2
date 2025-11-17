import dotenv from 'dotenv';
import { supabase } from '../server/services/supabase.js';
import { generateAlertEmbedding } from '../server/services/ragEngine.js';

dotenv.config();

/**
 * Generate embeddings for all alerts that don't have them
 */
async function generateEmbeddings() {
  try {
    console.log('🚀 Starting embedding generation...\n');

    // Get all alerts without embeddings
    const { data: alerts, error } = await supabase
      .from('alerts')
      .select('*')
      .is('embedding', null);

    if (error) {
      throw error;
    }

    if (!alerts || alerts.length === 0) {
      console.log('✅ All alerts already have embeddings!');
      return;
    }

    console.log(`📊 Found ${alerts.length} alerts without embeddings\n`);

    let processed = 0;
    let failed = 0;
    const batchSize = 10; // Process 10 at a time to avoid rate limits

    for (let i = 0; i < alerts.length; i += batchSize) {
      const batch = alerts.slice(i, i + batchSize);

      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(alerts.length / batchSize)}...`);

      for (const alert of batch) {
        try {
          // Generate embedding
          const embedding = await generateAlertEmbedding(alert);

          // Update alert with embedding
          const { error: updateError } = await supabase
            .from('alerts')
            .update({ embedding })
            .eq('id', alert.id);

          if (updateError) {
            console.error(`  ❌ Failed to update alert ${alert.id}:`, updateError.message);
            failed++;
          } else {
            processed++;
            process.stdout.write(`  ✓ ${processed}/${alerts.length} completed\r`);
          }
        } catch (error) {
          console.error(`  ❌ Error processing alert ${alert.id}:`, error.message);
          failed++;
        }
      }

      // Small delay between batches to avoid rate limits
      if (i + batchSize < alerts.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log('\n');
    console.log('═══════════════════════════════════════════════════');
    console.log('           EMBEDDING GENERATION COMPLETE           ');
    console.log('═══════════════════════════════════════════════════');
    console.log(`✅ Successfully processed: ${processed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📊 Total alerts: ${alerts.length}`);
    console.log('═══════════════════════════════════════════════════\n');

    console.log('🎉 RAG features are now enabled!');
    console.log('You can now ask analytical questions like:');
    console.log('  - "Why is TRT-Cisco-SW having issues?"');
    console.log('  - "Analyze the bandwidth drop patterns"');
    console.log('  - "What caused the interface failures?"\n');

  } catch (error) {
    console.error('❌ Error generating embeddings:', error);
    process.exit(1);
  }
}

// Run the script
console.log('\n╔═══════════════════════════════════════════════════════╗');
console.log('║     Generate Embeddings for RAG Functionality         ║');
console.log('╚═══════════════════════════════════════════════════════╝\n');

generateEmbeddings().then(() => {
  console.log('✨ Done!\n');
  process.exit(0);
});
