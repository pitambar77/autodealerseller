// Admin → Backups (IT / Technical Administrator, MD): automatic backup history, back up now, download.
// Restoring runs on the server (npm run restore) — see BACKUP_AND_RECOVERY.md in the API.
import { useEffect, useState } from 'react';
import { CheckCircle2, CloudUpload, DatabaseBackup, Download, Lock, TriangleAlert } from 'lucide-react';
import { API_URL, api, getToken } from '../../lib/api';
import { Alert, Badge, Button, DataTable, DL, PageHeader, Section, useToast } from '../../components/ui';
import { dateTime } from '../../utils/format';

const size = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export default function AdminBackups() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () =>
    api('GET', '/admin/backups')
      .then(setData)
      .catch((e) => toast(e.message, { tone: 'error' }));
  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async () => {
    setBusy(true);
    try {
      const r = await api('POST', '/admin/backups');
      toast(`Backup ${r.backup.file} written${r.backup.offsite?.ok ? ' and copied off-site' : ''}.`);
      load();
    } catch (e) {
      toast(e.message, { tone: 'error', title: 'Backup failed' });
    } finally {
      setBusy(false);
    }
  };
  // Download with the sign-in token (a plain link wouldn't carry it).
  const download = async (b) => {
    try {
      const res = await fetch(`${API_URL}/api/admin/backups/${b.id}/download`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Download failed.');
      const url = URL.createObjectURL(await res.blob());
      const a = Object.assign(document.createElement('a'), { href: url, download: b.file });
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast(e.message, { tone: 'error' });
    }
  };

  if (!data) return <p className="text-sm text-mist-500">Loading…</p>;
  const s = data.settings;
  const last = data.backups.find((b) => b.status !== 'failed');
  return (
    <div className="space-y-6">
      <PageHeader
        title="Backups"
        description="Copies of the whole database (and uploaded files stored on this server), made automatically. Each backup's checksum is recorded so a damaged or altered file is detected before restoring."
        actions={
          <Button icon={DatabaseBackup} onClick={run} loading={busy}>
            Back up now
          </Button>
        }
      />
      {!s.encrypted && (
        <Alert tone="warn" title="Backups are not encrypted">
          Set <span className="font-mono">BACKUP_ENCRYPTION_KEY</span> in the API's settings so backups (which contain customer details and identity documents) are encrypted. Keep the key somewhere safe and separate from the backups.
        </Alert>
      )}
      {!s.offsite && (
        <Alert tone="warn" title="No off-site copy">
          Set <span className="font-mono">BACKUP_OFFSITE</span> (Cloudinary, or a mounted cloud folder) so a copy survives if this server is lost.
        </Alert>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Section title="Backup history" bodyClass="p-0">
          <DataTable
            rowKey="id"
            rows={data.backups}
            empty="No backups yet. Click “Back up now”."
            columns={[
              { key: 'at', header: 'When', render: (b) => dateTime(b.at) },
              {
                key: 'status',
                header: 'Result',
                render: (b) =>
                  b.status === 'failed' ? (
                    <Badge tone="red" icon={TriangleAlert} title={b.error}>
                      Failed
                    </Badge>
                  ) : b.offsite?.ok ? (
                    <Badge tone="green" icon={CloudUpload}>
                      Local + off-site
                    </Badge>
                  ) : (
                    <Badge tone="amber" title={b.offsite?.error}>
                      Local only
                    </Badge>
                  ),
              },
              { key: 'size', header: 'Size', render: (b) => (b.size ? size(b.size) : '—') },
              { key: 'enc', header: '', render: (b) => (b.encrypted ? <Lock className="h-4 w-4 text-ok-600" aria-label="Encrypted" /> : null) },
              { key: 'by', header: 'By', render: (b) => b.by },
              { key: 'dl', header: '', align: 'right', render: (b) => (b.onDisk ? <Button size="sm" variant="ghost" icon={Download} onClick={() => download(b)}>Download</Button> : <span className="text-[12px] text-mist-400">removed</span>) },
            ]}
          />
        </Section>
        <div className="space-y-6">
          <Section title="Settings">
            <DL
              cols={1}
              items={[
                ['Automatic backups', s.everyHours ? `Every ${s.everyHours} hours` : 'Off (use a scheduled npm run backup)'],
                ['Kept on the server', `Last ${s.keep}`],
                ['Encryption', s.encrypted ? 'AES-256-GCM' : 'Off'],
                ['Off-site copy', s.offsite || 'Not set up'],
                ['Last good backup', last ? dateTime(last.at) : '—'],
              ]}
            />
            <p className="mt-3 text-[12.5px] text-mist-500">These are set in the API's .env file (see BACKUP_AND_RECOVERY.md).</p>
          </Section>
          <Section title="Restoring">
            <p className="flex items-start gap-2 text-[13.5px] text-mist-700">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ok-600" /> Restoring replaces live data, so it's done on the server by the technical administrator, following the recovery procedure: <span className="font-mono">npm run restore -- &lt;file&gt;</span> first checks the file, then <span className="font-mono">--yes</span> restores it.
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}
