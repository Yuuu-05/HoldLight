import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCamera } from '../../../app/providers/CameraProvider';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import EmptyState from '../../../shared/components/feedback/EmptyState';
import { routes } from '../../../shared/constants/routes';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import type { ClimbScan } from '../../../shared/types/climb';
import VolunteerCard from '../../volunteer/components/VolunteerCard';
import { useVolunteerBoard } from '../../volunteer/hooks/useVolunteerBoard';
import CameraPreview from '../components/CameraPreview';
import RouteCanvas from '../components/RouteCanvas';
import ScanPermissionNotice from '../components/ScanPermissionNotice';
import { useScanSession } from '../hooks/useScanSession';
import { getWallMapCoverage } from '../services/scan.service';

export default function ScanWallPage() {
  const { supported, stream, requestAccess } = useCamera();
  const { items, loading } = useVolunteerBoard();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { scanProgress, latestScan, startScan } = useScanSession();
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const uploadImageRef = useRef<HTMLImageElement>(null);
  const uploadVideoRef = useRef<HTMLVideoElement>(null);
  const [activeScan, setActiveScan] = useState<ClimbScan | null>(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);
  const [uploadName, setUploadName] = useState('');
  const [uploadType, setUploadType] = useState<'image' | 'video' | null>(null);
  const hasSecureContext = typeof window === 'undefined' ? true : window.isSecureContext;
  const scanBusy = scanProgress.status === 'scanning' || scanProgress.status === 'saving';

  usePageTitle('Assist');

  useEffect(() => {
    if (!latestScan) return;
    setActiveScan(latestScan);
  }, [latestScan]);

  useEffect(() => {
    return () => {
      if (uploadPreviewUrl) {
        URL.revokeObjectURL(uploadPreviewUrl);
      }
    };
  }, [uploadPreviewUrl]);

  async function handleScan(source: 'camera' | 'demo') {
    if (scanBusy) return;

    if (source === 'camera' && supported && hasSecureContext && !stream) {
      await requestAccess();
    }

    const scan = await startScan({
      source,
      gymName: 'Campus climbing gym',
      videoElement: videoRef.current,
    });

    if (scan) {
      setActiveScan(scan);
    }
  }

  async function handleUploadScan() {
    if (!uploadType || scanBusy) return;

    const scan = await startScan({
      gymName: 'Campus climbing gym',
      imageElement: uploadImageRef.current,
      uploadedVideoElement: uploadVideoRef.current,
      uploadType,
    });

    if (scan) {
      setActiveScan(scan);
    }
  }

  function handleUploadSelected(event: ChangeEvent<HTMLInputElement>, nextType: 'image' | 'video') {
    const file = event.target.files?.[0];
    if (!file) return;

    if (uploadPreviewUrl) {
      URL.revokeObjectURL(uploadPreviewUrl);
    }

    const nextUrl = URL.createObjectURL(file);
    setUploadPreviewUrl(nextUrl);
    setUploadName(file.name);
    setUploadType(nextType);
  }

  const displayScan = activeScan ?? latestScan;
  const scanCoverage = displayScan ? getWallMapCoverage(displayScan.wallMap) : null;
  const scanAnalysis = displayScan?.wallMap.analysis;
  const isReadyForAutonomousGuidance = Boolean(
    displayScan && (displayScan.wallMap.source === 'demo' || scanAnalysis?.shouldAllowAutonomousGuidance),
  );

  return (
    <section className="stack-lg">
      <Card title={t('Assist')} className="tone-blue">
        <p>{t('Open the wall scanning flow to prepare climbing guidance.')}</p>
        <ScanPermissionNotice supported={supported} hasSecureContext={hasSecureContext} />
        <CameraPreview stream={stream} videoRef={videoRef} />
        <div className="inline-actions wrap">
          <Button onClick={() => requestAccess()} disabled={!supported || !hasSecureContext || scanBusy}>
            {t('Allow camera')}
          </Button>
          <Button onClick={() => void handleScan('camera')} disabled={!supported || !hasSecureContext || scanBusy}>
            Scan with camera
          </Button>
          <Button variant="secondary" onClick={() => void handleScan('demo')} disabled={scanBusy}>
            Use demo wall
          </Button>
        </div>
      </Card>

      <Card title="Upload a wall photo or video" className="tone-yellow">
        <p>Upload a wall photo, or pause a short video on a clear frame, and run the same recognition pipeline without using the live camera.</p>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => handleUploadSelected(event, 'image')}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          className="sr-only"
          onChange={(event) => handleUploadSelected(event, 'video')}
        />
        <div className="inline-actions wrap">
          <Button variant="secondary" onClick={() => imageInputRef.current?.click()} disabled={scanBusy}>
            Upload photo
          </Button>
          <Button variant="secondary" onClick={() => videoInputRef.current?.click()} disabled={scanBusy}>
            Upload video
          </Button>
          <Button onClick={() => void handleUploadScan()} disabled={!uploadType || scanBusy}>
            Scan uploaded media
          </Button>
        </div>
        {uploadType && uploadPreviewUrl ? (
          <div className="stack-sm">
            <p className="subtle-text">Selected file: {uploadName}</p>
            {uploadType === 'image' ? (
              <img ref={uploadImageRef} className="camera-preview" src={uploadPreviewUrl} alt="Uploaded wall preview" />
            ) : (
              <video ref={uploadVideoRef} className="camera-preview" src={uploadPreviewUrl} controls playsInline muted />
            )}
          </div>
        ) : (
          <div className="camera-placeholder">Upload a wall photo or video to test recognition without the live camera.</div>
        )}
      </Card>

      <Card title="Current scan status">
        <p><strong>{scanProgress.message}</strong></p>
        <p className="subtle-text">Progress: {scanProgress.progress}%</p>
        {scanProgress.error ? <p className="error-banner">{scanProgress.error}</p> : null}
        {scanCoverage ? (
          <div className="stats-grid">
            <div><strong>{scanCoverage.holdCount}</strong><span>Detected holds</span></div>
            <div><strong>{scanCoverage.colorCount}</strong><span>Detected route colors</span></div>
            <div><strong>{scanCoverage.source}</strong><span>Scan source</span></div>
          </div>
        ) : null}
        {displayScan?.wallMap.scanNotes.length ? (
          <ol className="numbered-list subtle-text">
            {displayScan.wallMap.scanNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ol>
        ) : null}
      </Card>

      {displayScan ? (
        <Card title="Detection overlay preview">
          <RouteCanvas
            wallMap={displayScan.wallMap}
            backgroundImageUrl={displayScan.coverImageUrl}
            helperText="Original scan image with detected hold overlays. Use this view to verify the recognition result before choosing a route."
          />
        </Card>
      ) : null}

      {displayScan ? (
        <Card title="Autonomous readiness gate">
          {scanAnalysis ? (
            <>
              <p>
                {scanAnalysis.shouldAllowAutonomousGuidance
                  ? 'Automatic recognition is stable enough to continue to route setup.'
                  : scanAnalysis.suggestedAction === 'companion'
                    ? 'The wall is partially recognized, but this scan should be used with a companion or volunteer.'
                    : 'Recognition is not stable enough for autonomous guidance yet. Retake the scan from a clearer angle.'}
              </p>
              <div className="stats-grid">
                <div><strong>{Math.round(scanAnalysis.confidence * 100)}%</strong><span>Overall confidence</span></div>
                <div><strong>{scanAnalysis.detectionSummary.holdCount}</strong><span>Detected holds</span></div>
                <div><strong>{scanAnalysis.detectionSummary.routeCount}</strong><span>Route candidates</span></div>
              </div>
              <p className="subtle-text">Active provider: {scanAnalysis.provider}</p>
              <ol className="numbered-list subtle-text">
                {scanAnalysis.captureGuidance.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
              {scanAnalysis.routeCandidates.length ? (
                <div className="stack-sm">
                  <p><strong>Detected route candidates</strong></p>
                  <ol className="numbered-list subtle-text">
                    {scanAnalysis.routeCandidates.slice(0, 3).map((candidate) => (
                      <li key={candidate.id}>
                        {candidate.summary} Confidence {Math.round(candidate.confidence * 100)}%.
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
            </>
          ) : (
            <p>The demo wall skips the confidence gate and is ready for route setup.</p>
          )}

          <div className="inline-actions wrap">
            <Button onClick={() => navigate(routes.selectDifficulty)} disabled={!isReadyForAutonomousGuidance}>
              Continue to route setup
            </Button>
            <Button variant="secondary" onClick={() => navigate(routes.scanWall)}>
              Retake scan
            </Button>
            <Button variant="ghost" onClick={() => navigate(routes.volunteerBoard)}>
              Open companion mode
            </Button>
          </div>
        </Card>
      ) : null}

      <Card title={t('Volunteer board')} className="tone-yellow">
        <p>{t('Request help, browse upcoming support sessions, and express contact intent with low friction.')}</p>
        <div className="inline-actions wrap">
          <Link to={routes.volunteerCreate}><Button>{t('Create request')}</Button></Link>
          <Link to={routes.volunteerMySessions}>
            <Button variant="secondary">{t('My sessions')}</Button>
          </Link>
          <Link to={routes.contactIntent}><Button variant="ghost">{t('Contact intents')}</Button></Link>
        </div>
      </Card>

      {loading ? (
        <Card>
          <p>{t('Loading support posts...')}</p>
        </Card>
      ) : items.length ? (
        <div className="stack-lg">
          {items.map((item) => <VolunteerCard key={item.id} item={item} />)}
        </div>
      ) : (
        <EmptyState
          title={t('No support posts yet.')}
          body={t('Volunteer requests will appear here after users create them.')}
        />
      )}
    </section>
  );
}
