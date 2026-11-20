import { useEffect, useState } from 'react';
import { BrowserProvider, Contract, isAddress } from 'ethers';
import { Award, BadgeCheck, BookOpenCheck, CircleCheck, ExternalLink, Fingerprint, LoaderCircle, LockKeyhole, Search, ShieldCheck, Wallet } from 'lucide-react';
import config from './contract.json';

const blank = { studentName: '', studentId: '', diplomaTitle: '', issueDate: '', grade: '', recipient: '' };
const short = (value = '') => value ? `${value.slice(0, 6)}…${value.slice(-4)}` : '';

function metadataUri(form) {
  const metadata = { name: `Diplôme de ${form.studentName}`, description: `${form.diplomaTitle} · ${form.issueDate}`, attributes: [
    { trait_type: 'Étudiant', value: form.studentName }, { trait_type: 'Identifiant', value: form.studentId },
    { trait_type: 'Diplôme', value: form.diplomaTitle }, { trait_type: 'Date', value: form.issueDate }, { trait_type: 'Mention', value: form.grade || '—' },
  ] };
  return `data:application/json;base64,${btoa(unescape(encodeURIComponent(JSON.stringify(metadata))))}`;
}

function parseCsv(text) {
  const records = []; let record = []; let value = ''; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"' && quoted && text[i + 1] === '"') { value += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { record.push(value); value = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i++;
      record.push(value); records.push(record); record = []; value = '';
    } else value += char;
  }
  if (value || record.length) { record.push(value); records.push(record); }
  return records;
}

export default function App() {
  const [tab, setTab] = useState('issue');
  const [wallet, setWallet] = useState('');
  const [walletChainId, setWalletChainId] = useState(null);
  const [form, setForm] = useState(blank);
  const [lookup, setLookup] = useState('');
  const [certificate, setCertificate] = useState(null);
  const [rows, setRows] = useState([]);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const ready = Boolean(config.address && config.abi?.length);
  const networkName = walletChainId === 11155111 ? 'Sepolia' : walletChainId === 31337 ? 'Hardhat local' : walletChainId ? `Réseau ${walletChainId}` : (config.chainId === 11155111 ? 'Sepolia' : 'Hardhat local');

  useEffect(() => {
    if (!window.ethereum) return undefined;
    const refreshWallet = async () => {
      try {
        const [accounts, chainId] = await Promise.all([
          window.ethereum.request({ method: 'eth_accounts' }),
          window.ethereum.request({ method: 'eth_chainId' }),
        ]);
        setWallet(accounts[0] || '');
        setWalletChainId(Number(BigInt(chainId)));
      } catch { setWallet(''); setWalletChainId(null); }
    };
    refreshWallet();
    window.ethereum.on('accountsChanged', refreshWallet);
    window.ethereum.on('chainChanged', refreshWallet);
    return () => {
      window.ethereum.removeListener('accountsChanged', refreshWallet);
      window.ethereum.removeListener('chainChanged', refreshWallet);
    };
  }, []);

  async function connect() {
    try {
      if (!window.ethereum) throw new Error('Installez MetaMask pour connecter un portefeuille.');
      const provider = new BrowserProvider(window.ethereum);
      const [address] = await provider.send('eth_requestAccounts', []);
      const network = await provider.getNetwork();
      setWallet(address);
      setWalletChainId(Number(network.chainId));
      if (Number(network.chainId) !== config.chainId) throw new Error(`Choisissez le réseau du contrat (chain ID ${config.chainId}).`);
      setNotice('Portefeuille connecté.');
    } catch (error) { setNotice(readableError(error)); }
  }

  async function getContract(write = false) {
    if (!ready) throw new Error('Déployez le contrat avec npm run deploy:local.');
    if (!window.ethereum) throw new Error('Installez MetaMask pour continuer.');
    const provider = new BrowserProvider(window.ethereum);
    if (Number((await provider.getNetwork()).chainId) !== config.chainId) throw new Error('Mauvais réseau. Vérifiez le réseau sélectionné dans MetaMask.');
    return new Contract(config.address, config.abi, write ? await provider.getSigner() : provider);
  }

  async function mint(event) {
    event.preventDefault(); setBusy(true); setNotice('');
    try {
      if (!isAddress(form.recipient)) throw new Error('Adresse du portefeuille invalide.');
      const contract = await getContract(true);
      const tx = await contract.mintCertificate(form.recipient, form.studentName.trim(), form.studentId.trim(), form.diplomaTitle.trim(), form.issueDate, form.grade.trim(), metadataUri(form));
      setNotice('Transaction envoyée. En attente de confirmation…'); await tx.wait();
      const id = await contract.nextTokenId() - 1n;
      setNotice(`Certificat #${id} créé · ${short(tx.hash)}`); setForm(blank);
    } catch (error) { setNotice(readableError(error)); }
    finally { setBusy(false); }
  }

  async function find(event) {
    event.preventDefault(); setCertificate(null); setNotice(''); setBusy(true);
    try {
      if (!/^\d+$/.test(lookup) || Number(lookup) < 1) throw new Error('Saisissez un tokenId valide.');
      const contract = await getContract(); const item = await contract.getCertificate(lookup);
      setCertificate({ id: lookup, studentName: item.studentName, studentId: item.studentId, diplomaTitle: item.diplomaTitle, issueDate: item.issueDate, grade: item.grade, recipient: item.recipient, revoked: item.revoked, uri: item.uri });
    } catch (error) { setNotice(readableError(error)); }
    finally { setBusy(false); }
  }

  async function readCsv(file) {
    setNotice('');
    try {
      const text = await file.text();
      const [header, ...lines] = parseCsv(text);
      const names = header.map((name) => name.trim().replace(/^\uFEFF/, ''));
      const required = ['studentName', 'studentId', 'diplomaTitle', 'issueDate', 'recipientAddress'];
      if (required.some((name) => !names.includes(name))) throw new Error(`Colonnes obligatoires : ${required.join(', ')}`);
      const parsed = lines.filter((line) => line.some((value) => value.trim())).map((line) => Object.fromEntries(names.map((name, i) => [name, (line[i] || '').trim()])));
      const seen = new Set();
      const checked = parsed.map((row, index) => {
        let error = !row.studentName || !row.studentId || !row.diplomaTitle ? 'Champ obligatoire manquant' : !isAddress(row.recipientAddress) ? 'Adresse invalide' : '';
        if (seen.has(row.studentId)) error = 'Identifiant répété dans le fichier';
        seen.add(row.studentId);
        return { ...row, _number: index + 1, _error: error };
      });
      if (!checked.length) throw new Error('Le fichier ne contient aucune ligne de diplôme.');
      setRows(checked);
      setNotice(`${checked.length} ligne(s) chargée(s) · ${checked.filter((row) => row._error).length} erreur(s).`);
    } catch (error) { setRows([]); setNotice(error.message || 'Impossible de lire le CSV.'); }
  }

  async function mintBatch() {
    const validRows = rows.filter((row) => !row._error);
    if (!validRows.length) return;
    setBusy(true); setNotice('');
    try {
      const contract = await getContract(true);
      const tx = await contract.batchMintCertificates(
        validRows.map((row) => row.recipientAddress), validRows.map((row) => row.studentName),
        validRows.map((row) => row.studentId), validRows.map((row) => row.diplomaTitle),
        validRows.map((row) => row.issueDate), validRows.map((row) => row.grade || ''),
        validRows.map((row) => metadataUri({ ...row, grade: row.grade || '' }))
      );
      setNotice(`Transaction de lot envoyée · ${short(tx.hash)}`); await tx.wait();
      setNotice(`${validRows.length} certificat(s) émis dans un lot.`); setRows([]);
    } catch (error) { setNotice(readableError(error)); }
    finally { setBusy(false); }
  }

  async function revoke() {
    setBusy(true); setNotice('');
    try { const contract = await getContract(true); const tx = await contract.revokeCertificate(certificate.id); await tx.wait(); setCertificate({ ...certificate, revoked: true }); setNotice(`Certificat #${certificate.id} révoqué.`); }
    catch (error) { setNotice(readableError(error)); }
    finally { setBusy(false); }
  }

  return <div className="app"><header className="top"><a className="brand" href="#"><span className="brand-mark"><Award size={21}/></span>Diploma<span className="brand-period">.</span></a><div className="top-right"><span className="network"><i/>{networkName}</span><button className="wallet" onClick={connect}><Wallet size={16}/>{wallet ? short(wallet) : 'Connecter MetaMask'}</button></div></header>
    <main><section className="hero"><div className="eyebrow"><span/> REGISTRE ACADÉMIQUE · ERC-721</div><h1>Les réussites méritent<br/><em>une preuve durable.</em></h1><p>Émettez des diplômes vérifiables, conservés comme NFT sur la blockchain.</p></section>
      <nav className="tabs"><button className={tab === 'issue' ? 'selected' : ''} onClick={() => {setTab('issue');setNotice('')}}><BookOpenCheck size={16}/> Émettre</button><button className={tab === 'batch' ? 'selected' : ''} onClick={() => {setTab('batch');setNotice('')}}><Award size={16}/> Import en lot</button><button className={tab === 'verify' ? 'selected' : ''} onClick={() => {setTab('verify');setNotice('')}}><ShieldCheck size={16}/> Vérification publique</button></nav>
      {!ready && <div className="setup"><LockKeyhole size={17}/><span>Le contrat n’est pas encore déployé. Suivez le guide dans README.md.</span></div>}
      <div className="workspace">{tab === 'issue' ? <section className="card"><div className="card-heading"><span className="card-icon"><Award size={19}/></span><div><h2>Nouveau certificat</h2><p>Les champs essentiels sont enregistrés sur la blockchain.</p></div><span className="standard">ERC-721</span></div>
        <form onSubmit={mint}><div className="grid"><label>Nom de l’étudiant<input required value={form.studentName} onChange={e=>setForm({...form,studentName:e.target.value})} placeholder="Ex. Amina Benali"/></label><label>Identifiant étudiant<input required value={form.studentId} onChange={e=>setForm({...form,studentId:e.target.value})} placeholder="Ex. 2026-INF-042"/></label><label className="wide">Intitulé du diplôme<input required value={form.diplomaTitle} onChange={e=>setForm({...form,diplomaTitle:e.target.value})} placeholder="Licence en informatique"/></label><label>Date d’émission<input type="date" required value={form.issueDate} onChange={e=>setForm({...form,issueDate:e.target.value})}/></label><label>Mention <span className="optional">(facultatif)</span><input value={form.grade} onChange={e=>setForm({...form,grade:e.target.value})} placeholder="Bien, Très bien…"/></label><label className="wide">Portefeuille du diplômé<input required value={form.recipient} onChange={e=>setForm({...form,recipient:e.target.value})} placeholder="0x…"/></label></div>
        <div className="form-bottom"><span><Fingerprint size={15}/> Métadonnées générées automatiquement · tokenURI inclus</span><button className="primary" disabled={busy || !ready}>{busy ? <LoaderCircle className="spin" size={16}/> : <Award size={16}/>} Émettre le diplôme</button></div></form></section> : tab === 'verify' ? <section className="card verify"><div className="card-heading"><span className="card-icon"><Search size={19}/></span><div><h2>Vérifier un diplôme</h2><p>Chaque personne peut consulter l’état d’un certificat.</p></div></div><form className="search" onSubmit={find}><label>Identifiant du NFT (tokenId)<div><input required inputMode="numeric" value={lookup} onChange={e=>setLookup(e.target.value)} placeholder="Ex. 1"/><button className="primary" disabled={busy || !ready}>{busy ? <LoaderCircle className="spin" size={16}/> : <Search size={16}/>} Vérifier</button></div></label></form>
        {certificate && <div className="certificate"><div className="cert-title"><span className="cert-icon"><BadgeCheck size={22}/></span><div><small>CERTIFICAT #{certificate.id}</small><h3>{certificate.studentName}</h3></div><span className={`status ${certificate.revoked?'revoked':''}`}><i/>{certificate.revoked?'Révoqué':'Valide'}</span></div><div className="cert-grid"><span>Diplôme<strong>{certificate.diplomaTitle}</strong></span><span>Date<strong>{certificate.issueDate}</strong></span><span>Identifiant étudiant<strong>{certificate.studentId}</strong></span><span>Portefeuille<strong>{short(certificate.recipient)}</strong></span><span>Mention<strong>{certificate.grade||'—'}</strong></span><span>Token URI<strong className="uri">{certificate.uri}</strong></span></div>{wallet && <button className="revoke" onClick={revoke} disabled={busy||certificate.revoked}>Révoquer ce certificat</button>}</div>}
      </section> : <section className="card batch-card"><div className="card-heading"><span className="card-icon"><Award size={19}/></span><div><h2>Émission en lot</h2><p>Importez un CSV puis confirmez les certificats valides.</p></div></div><div className="batch-body"><label className="file-picker">Choisir un fichier CSV<input type="file" accept=".csv,text/csv" onChange={event => event.target.files?.[0] && readCsv(event.target.files[0])}/></label><a href="/etudiants-exemple.csv" download>Télécharger un exemple CSV</a><p>Colonnes : studentName, studentId, diplomaTitle, issueDate, recipientAddress, grade</p>{rows.length > 0 && <><div className="batch-list">{rows.map(row=><div className={row._error?'invalid':''} key={row._number}><span>{row._number}. {row.studentName || 'Sans nom'} · {row.studentId || 'sans identifiant'}</span><small>{row._error || 'Prêt à émettre'}</small></div>)}</div><button className="primary batch-submit" onClick={mintBatch} disabled={busy || !ready || !rows.some(row=>!row._error)}>{busy ? <LoaderCircle className="spin" size={16}/> : <Award size={16}/>} Émettre {rows.filter(row=>!row._error).length} certificat(s)</button></>}</div></section>}
      {notice && <div className="notice" role="status"><CircleCheck size={16}/>{notice}</div>}
      <div className="trust"><div><ShieldCheck/><strong>Contrôle des accès</strong><span>Seuls les rôles autorisés agissent</span></div><div><Fingerprint/><strong>Unicité garantie</strong><span>Un diplôme par identifiant étudiant</span></div><div><CircleCheck/><strong>Vérifiable publiquement</strong><span>La révocation reste visible</span></div></div>
    </div></main><footer><span>Diploma Registry <b>·</b> Devoir 2</span><span><i/> Contrat ERC-721 {ready ? 'connecté' : 'en attente'}</span></footer></div>;
}

function readableError(error) {
  const message = error?.shortMessage || error?.reason || error?.message || 'Une erreur est survenue.';
  if (/user rejected|ACTION_REJECTED/i.test(message)) return 'Transaction refusée dans MetaMask.';
  if (/MINTER_ROLE|AccessControl|missing role/i.test(message)) return 'Accès refusé : ce compte ne possède pas le rôle requis.';
  if (/already used/i.test(message)) return 'Un diplôme existe déjà pour cet identifiant étudiant.';
  if (/certificate not found/i.test(message)) return 'Aucun certificat ne correspond à ce tokenId.';
  if (/insufficient funds/i.test(message)) return 'Solde insuffisant en ETH de test.';
  return message.length > 180 ? `${message.slice(0,177)}…` : message;
}
