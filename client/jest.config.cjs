module.exports = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/tests/setup/jest.setup.js"],
  moduleFileExtensions: ["js", "jsx"],
  testMatch: ["<rootDir>/tests/unit/**/*.test.jsx"],
  transform: {
    "^.+\\.(js|jsx)$": "babel-jest"
  }
};
