const config = {
  plugins: {
    "@tailwindcss/postcss": {},
    // Every oklch() colour also written as rgb(), with oklch kept for browsers that read it.
    // Chrome before 111 (all of Windows 7, which stops at 109) drops an oklch value outright:
    // a red button there had no background and white text, so it looked like an empty line.
    "@csstools/postcss-oklab-function": { preserve: true },
  },
};

export default config;
