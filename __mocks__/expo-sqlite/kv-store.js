// In-memory stand-in for expo-sqlite's key-value store in Jest.
const data = new Map();
const Storage = {
  getItem: async (k) => (data.has(k) ? data.get(k) : null),
  setItem: async (k, v) => void data.set(k, v),
  removeItem: async (k) => void data.delete(k),
  getItemSync: (k) => (data.has(k) ? data.get(k) : null),
  setItemSync: (k, v) => void data.set(k, v),
  removeItemSync: (k) => void data.delete(k),
};
module.exports = Storage;
module.exports.default = Storage;
