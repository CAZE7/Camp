const required = { major: 20, minor: 19 };
const [major, minor] = process.versions.node.split('.').map(Number);
const supported = major > required.major || (major === required.major && minor >= required.minor);

if (!supported) {
  console.error(
    `Node.js ${required.major}.${required.minor}+ erforderlich; gefunden: ${process.versions.node}`
  );
  console.error('Nutze die Version aus .nvmrc (22) und starte den Befehl erneut.');
  process.exit(1);
}
