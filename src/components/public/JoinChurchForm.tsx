import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Printer,
  QrCode,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import { ChurchSettings, Fellowship, Leader, MemberRecord, Ministry } from '../../types/church';

export const MINISTRY_INVOLVEMENT_OPTIONS = [
  'Praise and Worship',
  'Ushering',
  'Media and Technical',
  "Children's Ministry",
  'Youth Ministry',
  'Evangelism and Outreach',
  'Prayer Ministry',
  'Hospitality',
  'Protocol',
  'Administration',
  'Intercessory Ministry',
  'Not yet decided',
] as const;

const KENYA_COUNTIES = [
  'Kisii',
  'Nyamira',
  'Migori',
  'Homa Bay',
  'Kisumu',
  'Nairobi',
  'Nakuru',
  'Kiambu',
  'Uasin Gishu',
  'Mombasa',
  'Kakamega',
  'Bomet',
  'Kericho',
  'Narok',
  'Machakos',
  'Kajiado',
  'Other / Diaspora',
];

interface JoinChurchFormProps {
  settings: ChurchSettings;
  fellowships: Fellowship[];
  ministries: Ministry[];
  leaders: Leader[];
}

interface FormState {
  // A. Personal Information
  fullName: string;
  gender: string;
  dateOfBirth: string;
  maritalStatus: string;
  nationality: string;
  photoUrl: string;
  // B. Contact Information
  phone: string;
  whatsappNumber: string;
  email: string;
  residentialAddress: string;
  location: string;
  county: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  // C. Spiritual Background
  acceptedChristChoice: 'Yes' | 'No' | 'Guidance' | '';
  isBaptisedChoice: 'Yes' | 'No' | '';
  baptismDate: string;
  previousChurch: string;
  membershipType: string;
  joinDate: string;
  // D. Ministry Involvement
  interestedMinistries: string[];
  // E. Church Fellowship Information
  fellowshipId: string;
  preferredFellowship: string;
  preferredService: string;
  assignedPastor: string;
  discipleshipStatus: string;
  preferredContactMethod: string;
  testimony: string;
  // F. Consent
  consent: boolean;
}

const INITIAL_FORM = (): FormState => ({
  fullName: '',
  gender: '',
  dateOfBirth: '',
  maritalStatus: '',
  nationality: 'Kenyan',
  photoUrl: '',
  phone: '',
  whatsappNumber: '',
  email: '',
  residentialAddress: '',
  location: '',
  county: 'Kisii',
  emergencyContactName: '',
  emergencyContactPhone: '',
  acceptedChristChoice: '',
  isBaptisedChoice: '',
  baptismDate: '',
  previousChurch: '',
  membershipType: 'New member',
  joinDate: new Date().toISOString().slice(0, 10),
  interestedMinistries: [],
  fellowshipId: '',
  preferredFellowship: '',
  preferredService: 'First service',
  assignedPastor: '',
  discipleshipStatus: 'Not started',
  preferredContactMethod: 'Phone',
  testimony: '',
  consent: false,
});

const STEPS = [
  { id: 1, short: 'Personal', title: 'A. Personal Information' },
  { id: 2, short: 'Contact', title: 'B. Contact Information' },
  { id: 3, short: 'Spiritual', title: 'C. Spiritual Background' },
  { id: 4, short: 'Ministries', title: 'D. Ministry Involvement' },
  { id: 5, short: 'Fellowship', title: 'E. Church Fellowship Info' },
  { id: 6, short: 'Consent', title: 'F. Review & Declaration' },
];

function resizeProfilePhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Unsupported image format.'));
      img.onload = () => {
        const maxDim = 420;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function triggerScopedPrint(printClassTarget: string) {
  document.body.classList.add('gvcc-printing-modal');
  const onAfterPrint = () => {
    document.body.classList.remove('gvcc-printing-modal');
    window.removeEventListener('afterprint', onAfterPrint);
  };
  window.addEventListener('afterprint', onAfterPrint);
  // Ensure target is mounted and print cleanly
  if (printClassTarget) {
    window.print();
  }
  setTimeout(() => {
    document.body.classList.remove('gvcc-printing-modal');
  }, 1500);
}

export const CrossEmblem: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
    <path
      d="M16 3V29M8 11H24"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="square"
    />
    <rect x="13.5" y="8.5" width="5" height="5" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
  </svg>
);

export const JoinChurchForm: React.FC<JoinChurchFormProps> = ({
  settings,
  fellowships,
  ministries,
  leaders,
}) => {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [stepError, setStepError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [registeredMember, setRegisteredMember] = useState<MemberRecord | null>(null);
  const [showQrPanel, setShowQrPanel] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);

  const registrationShareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/?register=1#join-church`
      : '#join-church';

  useEffect(() => {
    if (!showQrPanel || qrDataUrl) return;
    QRCode.toDataURL(registrationShareUrl, {
      width: 220,
      margin: 2,
      color: { dark: '#0F172A', light: '#FFFFFF' },
    })
      .then((url) => setQrDataUrl(url))
      .catch(() => {});
  }, [showQrPanel, qrDataUrl, registrationShareUrl]);

  const toggleMinistry = (name: string) => {
    setForm((prev) => {
      if (name === 'Not yet decided') {
        const already = prev.interestedMinistries.includes('Not yet decided');
        return { ...prev, interestedMinistries: already ? [] : ['Not yet decided'] };
      }
      const withoutUndecided = prev.interestedMinistries.filter((m) => m !== 'Not yet decided');
      const exists = withoutUndecided.includes(name);
      return {
        ...prev,
        interestedMinistries: exists
          ? withoutUndecided.filter((m) => m !== name)
          : [...withoutUndecided, name],
      };
    });
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStepError(null);
    if (!file.type.startsWith('image/')) {
      setStepError('Please upload a valid PNG, JPG, or WEBP image file.');
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      setStepError('Profile photo must be smaller than 6 MB.');
      return;
    }
    try {
      const resized = await resizeProfilePhoto(file);
      setForm((prev) => ({ ...prev, photoUrl: resized }));
    } catch (err: any) {
      setStepError(err?.message || 'Unable to process image.');
    }
  };

  const validateStep = (targetStep: number): string | null => {
    if (targetStep === 1) {
      if (form.fullName.trim().length < 2) return 'Please enter your full name.';
      if (!form.gender) return 'Please select your gender.';
      if (!form.dateOfBirth) return 'Please select your date of birth.';
      if (!form.maritalStatus) return 'Please select your marital status.';
      if (!form.nationality.trim()) return 'Please enter your nationality.';
    }
    if (targetStep === 2) {
      if (form.phone.trim().length < 6) return 'Please enter a valid phone number.';
      if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
        return 'Please enter a valid email address or leave it blank.';
      }
      if (form.residentialAddress.trim().length < 2) return 'Please enter your residential address.';
      if (form.location.trim().length < 2) return 'Please enter your estate or location.';
      if (!form.county.trim()) return 'Please enter or select your county.';
      if (form.emergencyContactName.trim().length < 2) return 'Please enter an emergency contact name.';
      if (form.emergencyContactPhone.trim().length < 6) return 'Please enter an emergency contact phone number.';
    }
    if (targetStep === 3) {
      if (!form.acceptedChristChoice) return 'Please indicate whether you have accepted Jesus Christ as Lord and Saviour.';
      if (!form.isBaptisedChoice) return 'Please indicate whether you have been baptised in water.';
      if (form.isBaptisedChoice === 'Yes' && !form.baptismDate) {
        return 'Please provide your water baptism date (or approximate date).';
      }
      if (!form.membershipType) return 'Please select your membership category.';
      if (!form.joinDate) return 'Please select your date of joining the church.';
    }
    if (targetStep === 4) {
      if (form.interestedMinistries.length === 0) {
        return 'Please select at least one ministry of interest (or choose "Not yet decided").';
      }
    }
    if (targetStep === 5) {
      if (!form.preferredService) return 'Please select your preferred Sunday service.';
      if (!form.discipleshipStatus) return 'Please select your discipleship class status.';
    }
    if (targetStep === 6) {
      if (!form.consent) {
        return 'You must check the consent and declaration box before submitting your registration.';
      }
    }
    return null;
  };

  const handleNext = () => {
    const err = validateStep(step);
    if (err) {
      setStepError(err);
      return;
    }
    setStepError(null);
    setStep((s) => Math.min(6, s + 1));
  };

  const handleBack = () => {
    setStepError(null);
    setStep((s) => Math.max(1, s - 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    for (let s = 1; s <= 6; s += 1) {
      const err = validateStep(s);
      if (err) {
        setStep(s);
        setStepError(err);
        return;
      }
    }

    setSubmitting(true);
    setStepError(null);
    try {
      const matchedMinistry = ministries.find((m) =>
        form.interestedMinistries.some(
          (sel) =>
            m.name.toLowerCase().includes(sel.toLowerCase().split(' ')[0]) ||
            sel.toLowerCase().includes(m.name.toLowerCase().split(' ')[0])
        )
      );
      const selectedFellowshipObj = fellowships.find((f) => String(f.id) === form.fellowshipId);

      const res = await fetch('/api/public/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          gender: form.gender,
          dateOfBirth: form.dateOfBirth,
          maritalStatus: form.maritalStatus,
          nationality: form.nationality.trim() || 'Kenyan',
          photoUrl: form.photoUrl || null,
          phone: form.phone.trim(),
          whatsappNumber: form.whatsappNumber.trim() || form.phone.trim(),
          email: form.email.trim() || null,
          residentialAddress: form.residentialAddress.trim(),
          location: form.location.trim(),
          county: form.county.trim() || 'Kisii',
          emergencyContactName: form.emergencyContactName.trim(),
          emergencyContactPhone: form.emergencyContactPhone.trim(),
          acceptedChrist: form.acceptedChristChoice === 'Yes',
          isBaptised: form.isBaptisedChoice === 'Yes',
          baptismDate: form.isBaptisedChoice === 'Yes' ? form.baptismDate : null,
          previousChurch: form.previousChurch.trim() || null,
          membershipType: form.membershipType,
          joinDate: form.joinDate,
          interestedMinistries: form.interestedMinistries,
          fellowshipId: form.fellowshipId ? Number(form.fellowshipId) : null,
          preferredFellowship:
            selectedFellowshipObj?.name || form.preferredFellowship.trim() || 'To be assigned',
          preferredService: form.preferredService,
          assignedPastor: form.assignedPastor.trim() || settings.leadPastor || 'To be assigned',
          discipleshipStatus: form.discipleshipStatus,
          ministryId: matchedMinistry ? matchedMinistry.id : null,
          preferredContactMethod: form.preferredContactMethod,
          testimony:
            form.acceptedChristChoice === 'Guidance'
              ? `[Requested Guidance on Salvation] ${form.testimony}`.trim()
              : form.testimony.trim() || null,
          consent: true,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Could not complete membership registration.');
      }
      setRegisteredMember(json.member);
    } catch (err: any) {
      setStepError(err?.message || 'Registration failed. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const downloadConfirmationSlip = (member: MemberRecord) => {
    const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>GVCC Membership Confirmation - ${member.memberNumber}</title>
<style>
  body { font-family: Georgia, serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 32px; }
  .card { max-width: 720px; margin: 0 auto; background: #ffffff; border: 2px solid #0f172a; }
  .header { background: #0f172a; color: #ffffff; padding: 24px 28px; border-bottom: 4px solid #b4823e; }
  .header h1 { margin: 6px 0 2px; font-size: 22px; }
  .header p { margin: 0; color: #e2c28b; font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase; font-family: sans-serif; }
  .body { padding: 24px 28px; font-family: sans-serif; font-size: 13px; }
  .id-box { background: #fbf9f5; border: 1px solid #b4823e; padding: 14px 18px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: center; }
  .id-num { font-family: monospace; font-size: 20px; font-weight: bold; color: #0f172a; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  td { padding: 7px 6px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  td.lbl { width: 38%; color: #475569; font-weight: 600; }
  .footer { padding: 16px 28px; background: #f1f5f9; font-family: sans-serif; font-size: 11px; color: #475569; }
</style>
</head>
<body>
  <div class="card">
    <div class="header">
      <p>${settings.churchName} · ${settings.location}</p>
      <h1>Welcome Home! Official Membership Registration Confirmation</h1>
    </div>
    <div class="body">
      <div class="id-box">
        <div>
          <div style="font-size:11px;color:#9a6b2f;text-transform:uppercase;font-weight:700;">Unique Membership ID</div>
          <div class="id-num">${member.memberNumber}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:11px;color:#64748b;">Registration Status</div>
          <div style="font-weight:700;color:#0f172a;">${member.membershipStatus}</div>
        </div>
      </div>
      <table>
        <tr><td class="lbl">Full Name</td><td>${member.fullName}</td></tr>
        <tr><td class="lbl">Gender &amp; Marital Status</td><td>${member.gender || '—'} · ${member.maritalStatus || '—'}</td></tr>
        <tr><td class="lbl">Phone / WhatsApp</td><td>${member.phone} / ${member.whatsappNumber || member.phone}</td></tr>
        <tr><td class="lbl">Email</td><td>${member.email || '—'}</td></tr>
        <tr><td class="lbl">Residence / County</td><td>${[member.residentialAddress, member.location, member.county].filter(Boolean).join(', ') || '—'}</td></tr>
        <tr><td class="lbl">Membership Category</td><td>${member.membershipType}</td></tr>
        <tr><td class="lbl">Date of Joining</td><td>${member.joinDate || member.registrationDate}</td></tr>
        <tr><td class="lbl">Ministry Involvement</td><td>${(member.interestedMinistries || []).join(', ') || 'Not yet decided'}</td></tr>
        <tr><td class="lbl">Preferred Fellowship &amp; Service</td><td>${member.preferredFellowship || 'To be assigned'} · ${member.preferredService || 'First service'}</td></tr>
        <tr><td class="lbl">Assigned Pastor / Leader</td><td>${member.assignedPastor || settings.leadPastor}</td></tr>
        <tr><td class="lbl">Discipleship Status</td><td>${member.discipleshipStatus || 'Not started'}</td></tr>
      </table>
    </div>
    <div class="footer">
      Generated digitally by ${settings.churchName} (${settings.phone}). Keep this confirmation slip for pastoral records.
    </div>
  </div>
</body>
</html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${member.memberNumber}-membership-confirmation.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div id="join-church" className="bg-white border border-slate-200 overflow-hidden">
      {/* Christian Navy, White & Gold Brand Header */}
      <div className="bg-[#0F172A] text-white px-6 py-6 sm:px-8 border-b-4 border-[#B4823E] no-print">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-white/10 border border-[#B4823E] flex items-center justify-center shrink-0 text-[#E2C28B]">
              <CrossEmblem className="w-7 h-7" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-[#E2C28B] font-semibold">
                {settings.churchName} · {settings.location}
              </p>
              <h3 className="font-serif text-xl sm:text-2xl font-medium text-white mt-0.5">
                Welcome Home! We Are Glad You Are Here.
              </h3>
              <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
                Complete your digital church membership profile below to connect with fellowship groups, pastoral care, and service ministries.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowQrPanel((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-medium text-white cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5 text-[#E2C28B]" />
              {showQrPanel ? 'Hide QR / Link' : 'Share QR & Link'}
            </button>
          </div>
        </div>

        {/* Optional Shareable Link & QR Code Drawer */}
        {showQrPanel && (
          <div className="mt-5 pt-5 border-t border-white/15 grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-5 items-center">
            {qrDataUrl && (
              <div className="bg-white p-2 inline-block w-fit">
                <img src={qrDataUrl} alt="Scan to open GVCC Membership Registration" className="w-28 h-28 block" />
              </div>
            )}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[#E2C28B] uppercase tracking-wider">
                Direct Mobile Registration Link
              </p>
              <p className="text-xs text-slate-300">
                Scan this QR code in service or share the direct link below so members can register easily from any phone or tablet.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <code className="text-[11px] font-mono bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-slate-200 break-all">
                  {registrationShareUrl}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(registrationShareUrl).catch(() => {});
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#B4823E] hover:bg-[#9A6B2F] text-white text-xs font-semibold cursor-pointer"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedLink ? 'Copied' : 'Copy Link'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SUCCESSFUL REGISTRATION CONFIRMATION RECEIPT */}
      {registeredMember ? (
        <div className="p-6 sm:p-8 space-y-6 gvcc-printable-area">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-9 h-9 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[#9A6B2F] font-semibold">
                  Registration Confirmed · {settings.shortName}
                </p>
                <h4 className="font-serif text-2xl font-medium text-[#0F172A]">
                  Welcome to the Family, {registeredMember.fullName}!
                </h4>
                <p className="text-xs text-slate-600 mt-1">
                  Your membership details have been securely saved in the GVCC Membership Register.
                </p>
              </div>
            </div>

            {registeredMember.photoUrl && (
              <img
                src={registeredMember.photoUrl}
                alt={registeredMember.fullName}
                className="w-16 h-16 object-cover border border-slate-300 shrink-0"
              />
            )}
          </div>

          <div className="bg-[#FBF9F5] border border-[#B4823E]/40 p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-[#9A6B2F] font-semibold">
                Official Membership ID
              </p>
              <p className="font-mono tabular-nums text-2xl font-semibold text-[#0F172A] mt-0.5">
                {registeredMember.memberNumber}
              </p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                Membership Status
              </p>
              <p className="text-sm font-semibold text-[#0F172A] mt-0.5">
                {registeredMember.membershipStatus} · {registeredMember.membershipType}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-xs border border-slate-200 p-5 bg-white">
            <div>
              <span className="text-slate-500 block">Personal Profile</span>
              <strong className="text-slate-900">
                {registeredMember.gender || '—'} · DOB: {registeredMember.dateOfBirth || '—'} · {registeredMember.maritalStatus || '—'}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block">Phone &amp; WhatsApp</span>
              <strong className="text-slate-900 font-mono">
                {registeredMember.phone} / {registeredMember.whatsappNumber || registeredMember.phone}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block">Residence &amp; County</span>
              <strong className="text-slate-900">
                {[registeredMember.residentialAddress, registeredMember.location, registeredMember.county]
                  .filter(Boolean)
                  .join(', ') || '—'}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block">Emergency Contact</span>
              <strong className="text-slate-900">
                {registeredMember.emergencyContactName || '—'} ({registeredMember.emergencyContactPhone || '—'})
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block">Spiritual Milestones</span>
              <strong className="text-slate-900">
                Salvation: {registeredMember.acceptedChrist ? 'Yes' : 'Guided/No'} · Water Baptised:{' '}
                {registeredMember.isBaptised ? `Yes (${registeredMember.baptismDate || 'Recorded'})` : 'Not yet'}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block">Fellowship &amp; Service</span>
              <strong className="text-slate-900">
                {registeredMember.preferredFellowship || 'To be assigned'} · {registeredMember.preferredService}
              </strong>
            </div>
            <div className="sm:col-span-2">
              <span className="text-slate-500 block">Interested Ministries</span>
              <strong className="text-slate-900">
                {(registeredMember.interestedMinistries || []).join(', ') || 'Not yet decided'}
              </strong>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 no-print">
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => triggerScopedPrint('gvcc-printable-area')}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                Print / Save as PDF
              </button>
              <button
                type="button"
                onClick={() => downloadConfirmationSlip(registeredMember)}
                className="inline-flex items-center gap-2 px-4 py-2.5 border border-[#B4823E] text-[#9A6B2F] hover:bg-[#FBF9F5] text-xs font-semibold cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Download Confirmation Slip
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setRegisteredMember(null);
                setForm(INITIAL_FORM());
                setStep(1);
                setStepError(null);
              }}
              className="px-4 py-2.5 border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Register Another Family Member
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
          {/* Progress Indicator */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#0F172A]">
                Step {step} of {STEPS.length}: <span className="text-[#9A6B2F]">{STEPS[step - 1].title}</span>
              </span>
              <span className="font-mono tabular-nums text-slate-500">
                {Math.round((step / STEPS.length) * 100)}% Complete
              </span>
            </div>
            <div className="h-1.5 bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-[#B4823E] transition-all duration-300"
                style={{ width: `${(step / STEPS.length) * 100}%` }}
              />
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {STEPS.map((s) => {
                const active = s.id === step;
                const completed = s.id < step;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      if (s.id < step) {
                        setStepError(null);
                        setStep(s.id);
                      }
                    }}
                    disabled={s.id > step}
                    className={`py-1.5 px-2 text-[11px] font-medium border text-center transition-colors ${
                      active
                        ? 'bg-[#0F172A] text-white border-[#0F172A]'
                        : completed
                          ? 'bg-[#FBF9F5] text-[#9A6B2F] border-[#B4823E]/50 hover:bg-[#F3EFE7] cursor-pointer'
                          : 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
                    }`}
                  >
                    {s.id}. {s.short}
                  </button>
                );
              })}
            </div>
          </div>

          {stepError && (
            <div className="flex items-start gap-2.5 text-xs text-red-800 bg-red-50 border border-red-200 p-3.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{stepError}</span>
            </div>
          )}

          {/* STEP 1: A. PERSONAL INFORMATION */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    placeholder="Enter your full official name"
                    className="w-full px-3.5 py-2.5 border border-slate-300 text-sm focus:outline-none focus:border-[#0F172A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Gender *
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {['Male', 'Female'].map((g) => (
                      <label
                        key={g}
                        className={`flex items-center gap-2 px-3.5 py-2.5 border text-sm cursor-pointer ${
                          form.gender === g
                            ? 'border-[#0F172A] bg-[#FBF9F5] font-semibold text-[#0F172A]'
                            : 'border-slate-300 text-slate-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name="gender"
                          checked={form.gender === g}
                          onChange={() => setForm({ ...form, gender: g })}
                          className="accent-[#0F172A]"
                        />
                        <span>{g}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Date of Birth *
                  </label>
                  <input
                    type="date"
                    required
                    max={new Date().toISOString().slice(0, 10)}
                    value={form.dateOfBirth}
                    onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-300 text-sm focus:outline-none focus:border-[#0F172A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Marital Status *
                  </label>
                  <select
                    required
                    value={form.maritalStatus}
                    onChange={(e) => setForm({ ...form, maritalStatus: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-300 text-sm bg-white focus:outline-none focus:border-[#0F172A]"
                  >
                    <option value="">Select marital status</option>
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Widowed">Widowed</option>
                    <option value="Separated / Divorced">Separated / Divorced</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nationality *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.nationality}
                    onChange={(e) => setForm({ ...form, nationality: e.target.value })}
                    placeholder="e.g., Kenyan"
                    className="w-full px-3.5 py-2.5 border border-slate-300 text-sm focus:outline-none focus:border-[#0F172A]"
                  />
                </div>
              </div>

              {/* Optional Profile Photo Upload */}
              <div className="border border-dashed border-slate-300 bg-[#FBF9F5] p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {form.photoUrl ? (
                      <img
                        src={form.photoUrl}
                        alt="Profile preview"
                        className="w-14 h-14 object-cover border border-slate-300"
                      />
                    ) : (
                      <div className="w-14 h-14 bg-white border border-slate-200 flex items-center justify-center text-slate-400">
                        <Camera className="w-5 h-5" />
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-semibold text-slate-800">Profile Photo (Optional)</p>
                      <p className="text-[11px] text-slate-500">
                        Helps church pastors and fellowship leaders recognize and welcome you personally.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-xs font-medium text-slate-800 cursor-pointer">
                      <Camera className="w-3.5 h-3.5 text-[#9A6B2F]" />
                      <span>{form.photoUrl ? 'Change Photo' : 'Upload Photo'}</span>
                      <input type="file" accept="image/*" onChange={handlePhotoChange} className="sr-only" />
                    </label>
                    {form.photoUrl && (
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, photoUrl: '' })}
                        className="inline-flex items-center gap-1 px-2.5 py-2 border border-red-200 text-red-700 text-xs cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: B. CONTACT INFORMATION */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="e.g., 0727 543 663"
                    className="w-full px-3.5 py-2.5 border border-slate-300 text-sm font-mono focus:outline-none focus:border-[#0F172A]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      WhatsApp Number
                    </label>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, whatsappNumber: form.phone })}
                      className="text-[11px] font-medium text-[#9A6B2F] hover:underline cursor-pointer"
                    >
                      Same as phone
                    </button>
                  </div>
                  <input
                    type="tel"
                    value={form.whatsappNumber}
                    onChange={(e) => setForm({ ...form, whatsappNumber: e.target.value })}
                    placeholder="Optional if different from phone"
                    className="w-full px-3.5 py-2.5 border border-slate-300 text-sm font-mono focus:outline-none focus:border-[#0F172A]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="name@example.com"
                    className="w-full px-3.5 py-2.5 border border-slate-300 text-sm focus:outline-none focus:border-[#0F172A]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Residential Address *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.residentialAddress}
                    onChange={(e) => setForm({ ...form, residentialAddress: e.target.value })}
                    placeholder="Plot, street, home area, or nearest landmark"
                    className="w-full px-3.5 py-2.5 border border-slate-300 text-sm focus:outline-none focus:border-[#0F172A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Estate / Location *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    placeholder="e.g., Ogembo Town, Tendere, Etono"
                    className="w-full px-3.5 py-2.5 border border-slate-300 text-sm focus:outline-none focus:border-[#0F172A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    County *
                  </label>
                  <input
                    list="gvcc-counties"
                    required
                    value={form.county}
                    onChange={(e) => setForm({ ...form, county: e.target.value })}
                    placeholder="e.g., Kisii"
                    className="w-full px-3.5 py-2.5 border border-slate-300 text-sm focus:outline-none focus:border-[#0F172A]"
                  />
                  <datalist id="gvcc-counties">
                    {KENYA_COUNTIES.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Emergency Contact Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.emergencyContactName}
                    onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })}
                    placeholder="Next of kin / family contact"
                    className="w-full px-3.5 py-2.5 border border-slate-300 text-sm focus:outline-none focus:border-[#0F172A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Emergency Contact Phone *
                  </label>
                  <input
                    type="tel"
                    required
                    value={form.emergencyContactPhone}
                    onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })}
                    placeholder="Emergency phone number"
                    className="w-full px-3.5 py-2.5 border border-slate-300 text-sm font-mono focus:outline-none focus:border-[#0F172A]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: C. SPIRITUAL BACKGROUND */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Have you accepted Jesus Christ as your Lord and Saviour? *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    { value: 'Yes', label: 'Yes, I have' },
                    { value: 'No', label: 'Not yet' },
                    { value: 'Guidance', label: 'Would like guidance' },
                  ].map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex items-center gap-2 px-3.5 py-2.5 border text-sm cursor-pointer ${
                        form.acceptedChristChoice === opt.value
                          ? 'border-[#0F172A] bg-[#FBF9F5] font-semibold text-[#0F172A]'
                          : 'border-slate-300 text-slate-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name="acceptedChrist"
                        checked={form.acceptedChristChoice === opt.value}
                        onChange={() =>
                          setForm({ ...form, acceptedChristChoice: opt.value as FormState['acceptedChristChoice'] })
                        }
                        className="accent-[#0F172A]"
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">
                    Have you been baptised in water? *
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {(['Yes', 'No'] as const).map((choice) => (
                      <label
                        key={choice}
                        className={`flex items-center gap-2 px-3.5 py-2.5 border text-sm cursor-pointer ${
                          form.isBaptisedChoice === choice
                            ? 'border-[#0F172A] bg-[#FBF9F5] font-semibold text-[#0F172A]'
                            : 'border-slate-300 text-slate-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name="isBaptised"
                          checked={form.isBaptisedChoice === choice}
                          onChange={() =>
                            setForm({
                              ...form,
                              isBaptisedChoice: choice,
                              baptismDate: choice === 'No' ? '' : form.baptismDate,
                            })
                          }
                          className="accent-[#0F172A]"
                        />
                        <span>{choice}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {form.isBaptisedChoice === 'Yes' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-2">
                      Water Baptism Date *
                    </label>
                    <input
                      type="date"
                      required
                      max={new Date().toISOString().slice(0, 10)}
                      value={form.baptismDate}
                      onChange={(e) => setForm({ ...form, baptismDate: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-slate-300 text-sm focus:outline-none focus:border-[#0F172A]"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Previous Church Attended (Optional)
                </label>
                <input
                  type="text"
                  value={form.previousChurch}
                  onChange={(e) => setForm({ ...form, previousChurch: e.target.value })}
                  placeholder="Name of previous congregation if transferring or returning"
                  className="w-full px-3.5 py-2.5 border border-slate-300 text-sm focus:outline-none focus:border-[#0F172A]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Membership Category *
                  </label>
                  <select
                    required
                    value={form.membershipType}
                    onChange={(e) => setForm({ ...form, membershipType: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-300 text-sm bg-white focus:outline-none focus:border-[#0F172A]"
                  >
                    <option value="New member">New member</option>
                    <option value="Transferring member">Transferring member</option>
                    <option value="Returning member">Returning member</option>
                    <option value="Visitor">Visitor</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Date of Joining the Church *
                  </label>
                  <input
                    type="date"
                    required
                    value={form.joinDate}
                    onChange={(e) => setForm({ ...form, joinDate: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-300 text-sm focus:outline-none focus:border-[#0F172A]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: D. MINISTRY INVOLVEMENT */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-slate-800">
                    Select the church ministries you are interested in serving with *
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    You may select multiple areas of calling, or choose &ldquo;Not yet decided&rdquo;.
                  </p>
                </div>
                <span className="font-mono text-xs text-[#9A6B2F] font-semibold">
                  {form.interestedMinistries.length} selected
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {MINISTRY_INVOLVEMENT_OPTIONS.map((ministryName) => {
                  const checked = form.interestedMinistries.includes(ministryName);
                  return (
                    <label
                      key={ministryName}
                      className={`flex items-center gap-3 px-3.5 py-2.5 border text-sm cursor-pointer transition-colors ${
                        checked
                          ? 'border-[#B4823E] bg-[#FBF9F5] text-[#0F172A] font-medium'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleMinistry(ministryName)}
                        className="accent-[#0F172A] w-4 h-4 shrink-0"
                      />
                      <span>{ministryName}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 5: E. CHURCH FELLOWSHIP INFORMATION */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Preferred Fellowship / Cell Group
                  </label>
                  <select
                    value={form.fellowshipId}
                    onChange={(e) => {
                      const val = e.target.value;
                      const matched = fellowships.find((f) => String(f.id) === val);
                      setForm({
                        ...form,
                        fellowshipId: val,
                        preferredFellowship: matched ? matched.name : form.preferredFellowship,
                      });
                    }}
                    className="w-full px-3.5 py-2.5 border border-slate-300 text-sm bg-white focus:outline-none focus:border-[#0F172A]"
                  >
                    <option value="">Not yet assigned / Help me choose</option>
                    {fellowships.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Cell Group / Home Fellowship Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={form.preferredFellowship}
                    onChange={(e) => setForm({ ...form, preferredFellowship: e.target.value })}
                    placeholder="Specific home cell or neighborhood group"
                    className="w-full px-3.5 py-2.5 border border-slate-300 text-sm focus:outline-none focus:border-[#0F172A]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Preferred Service *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {['First service', 'Second service', 'Other'].map((svc) => (
                    <label
                      key={svc}
                      className={`flex items-center gap-2 px-3.5 py-2.5 border text-sm cursor-pointer ${
                        form.preferredService === svc
                          ? 'border-[#0F172A] bg-[#FBF9F5] font-semibold text-[#0F172A]'
                          : 'border-slate-300 text-slate-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name="preferredService"
                        checked={form.preferredService === svc}
                        onChange={() => setForm({ ...form, preferredService: svc })}
                        className="accent-[#0F172A]"
                      />
                      <span>{svc}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Assigned Pastor or Church Leader (Optional)
                  </label>
                  <input
                    list="gvcc-leaders-list"
                    value={form.assignedPastor}
                    onChange={(e) => setForm({ ...form, assignedPastor: e.target.value })}
                    placeholder={settings.leadPastor || 'Select or type pastor name'}
                    className="w-full px-3.5 py-2.5 border border-slate-300 text-sm focus:outline-none focus:border-[#0F172A]"
                  />
                  <datalist id="gvcc-leaders-list">
                    <option value={settings.leadPastor} />
                    {leaders.map((l) => (
                      <option key={l.id} value={l.fullName} />
                    ))}
                    <option value="To be assigned by church office" />
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Discipleship Class Status *
                  </label>
                  <select
                    required
                    value={form.discipleshipStatus}
                    onChange={(e) => setForm({ ...form, discipleshipStatus: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-300 text-sm bg-white focus:outline-none focus:border-[#0F172A]"
                  >
                    <option value="Not started">Not started</option>
                    <option value="In progress">In progress</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Preferred Pastoral Contact Method
                  </label>
                  <select
                    value={form.preferredContactMethod}
                    onChange={(e) => setForm({ ...form, preferredContactMethod: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-300 text-sm bg-white focus:outline-none focus:border-[#0F172A]"
                  >
                    <option value="Phone">Phone Call</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Email">Email</option>
                    <option value="In Person">In Person</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Short Faith Testimony or Note (Optional)
                  </label>
                  <input
                    type="text"
                    value={form.testimony}
                    onChange={(e) => setForm({ ...form, testimony: e.target.value })}
                    placeholder="Share a brief blessing or prayer note"
                    className="w-full px-3.5 py-2.5 border border-slate-300 text-sm focus:outline-none focus:border-[#0F172A]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 6: F. CONSENT AND DECLARATION */}
          {step === 6 && (
            <div className="space-y-5">
              <div className="border border-slate-200 bg-[#FBF9F5] p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#0F172A]">
                    Registration Review Summary
                  </p>
                  <span className="text-[11px] text-slate-500">Verify details before submitting</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500">Personal: </span>
                    <strong className="text-slate-900">
                      {form.fullName} ({form.gender}, {form.maritalStatus}, DOB {form.dateOfBirth})
                    </strong>
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="ml-2 text-[#9A6B2F] underline cursor-pointer"
                    >
                      Edit
                    </button>
                  </div>
                  <div>
                    <span className="text-slate-500">Contact: </span>
                    <strong className="text-slate-900">
                      {form.phone} · {form.location}, {form.county}
                    </strong>
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="ml-2 text-[#9A6B2F] underline cursor-pointer"
                    >
                      Edit
                    </button>
                  </div>
                  <div>
                    <span className="text-slate-500">Spiritual: </span>
                    <strong className="text-slate-900">
                      {form.membershipType} · Saviour: {form.acceptedChristChoice} · Baptised: {form.isBaptisedChoice}
                    </strong>
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="ml-2 text-[#9A6B2F] underline cursor-pointer"
                    >
                      Edit
                    </button>
                  </div>
                  <div>
                    <span className="text-slate-500">Fellowship &amp; Ministries: </span>
                    <strong className="text-slate-900">
                      {form.preferredService} · {form.interestedMinistries.join(', ')}
                    </strong>
                    <button
                      type="button"
                      onClick={() => setStep(4)}
                      className="ml-2 text-[#9A6B2F] underline cursor-pointer"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-4 space-y-3">
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-[#0F172A] shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-700 leading-relaxed space-y-1.5">
                    <p className="font-semibold text-[#0F172A]">
                      Membership Declaration &amp; Data Protection Consent
                    </p>
                    <p>
                      I declare that all information submitted in this membership registration form is accurate and truthful to the best of my knowledge. I hereby consent to <strong>{settings.churchName}</strong> securely storing and processing my personal details strictly for church membership administration, discipleship tracking, and pastoral communication in accordance with applicable data protection principles.
                    </p>
                  </div>
                </div>

                <label className="flex items-start gap-2.5 pt-2 border-t border-slate-200 text-xs text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    required
                    checked={form.consent}
                    onChange={(e) => setForm({ ...form, consent: e.target.checked })}
                    className="accent-[#0F172A] w-4 h-4 mt-0.5 shrink-0"
                  />
                  <span className="font-medium">
                    I confirm that the information submitted is accurate and I consent to {settings.churchName} storing and using my information for membership administration and pastoral communication. *
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Step Footer Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200">
            {step > 1 ? (
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Previous Step
              </button>
            ) : (
              <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#9A6B2F]" />
                All fields marked * are required
              </span>
            )}

            {step < STEPS.length ? (
              <button
                type="button"
                onClick={handleNext}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
              >
                <span>Continue to {STEPS[step].short}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#B4823E] hover:bg-[#9A6B2F] disabled:opacity-60 text-white text-sm font-semibold cursor-pointer"
              >
                <UserCheck className="w-4 h-4" />
                <span>{submitting ? 'Submitting Registration...' : 'Submit Registration'}</span>
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
};
