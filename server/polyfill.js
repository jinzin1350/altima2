// Polyfill for Node.js 18 to make Supabase work
// This adds the missing File global that Supabase expects

if (typeof global.File === 'undefined') {
  // Simple File polyfill for Node.js 18
  class FilePolyfill {
    constructor(bits, name, options = {}) {
      this.bits = bits;
      this.name = name;
      this.type = options.type || '';
      this.lastModified = options.lastModified || Date.now();
    }
  }

  global.File = FilePolyfill;
}
