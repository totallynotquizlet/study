// Parse hash like: #data=base64...
function getRawHash() {
  return location.hash.replace(/^#/, "");
}

function decodeSet() {
  const hash = getRawHash();
  if (!hash) return null;

  try {
    return JSON.parse(atob(hash));
  } catch {
    return null;
  }
}

function encodeSet(set) {
  return "#" + btoa(JSON.stringify(set));
}

function requireSet() {
  const set = decodeSet();
  if (!set) location.href = "/";
  return set;
}

window.TNQ = {
  decodeSet,
  encodeSet,
  requireSet
};
