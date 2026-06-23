import React, { useEffect, useState, useCallback, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  Linking, 
  TextInput, 
  Switch, 
  Image, 
  Platform, 
  Alert 
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from 'expo-router';
import { 
  Link as LinkIcon, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ExternalLink, 
  Truck, 
  Server, 
  Settings2,
  ArrowLeft,
  Plus,
  Trash2,
  Bot,
  Smartphone,
  ChevronRight,
  ChevronDown,
  UserCheck,
  Users,
  Check,
  CheckCheck,
  Mail,
  Phone,
  Building2,
  Globe,
  Calendar,
  Lock,
  Eye,
  EyeOff,
  Download,
  Wifi,
  WifiOff
} from 'lucide-react-native';
import Svg, { Polygon, Rect, Circle, Defs, RadialGradient, Stop, Path, LinearGradient } from 'react-native-svg';

import Theme from '@/constants/theme';
import { Typography } from '@/components/ui/Typography';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/Badge';
import { useAppTheme } from '@/src/theme/appTheme';
import { AnimatedScreen } from '@/components/ui/AnimatedScreen';
import { SkeletonBlock } from '@/components/ui/SkeletonLoader';
import { getConnectedIntegrations } from '@/src/services/integration.service';
import { ConnectedIntegration } from '@/src/types/chat';
import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from '@/src/api/apiClient';

// ── CUSTOM BRAND SVG ICONS (React Native Svg Port) ──────────────────────────

const WhatsAppIcon = ({ size = 24 }: { size?: number }) => (
  <Svg viewBox="0 0 175.216 175.552" width={size} height={size}>
    <Defs>
      <LinearGradient id="waGradient" x1="85.915" x2="86.535" y1="32.567" y2="137.092" gradientUnits="userSpaceOnUse">
        <Stop offset="0" stopColor="#57d163" />
        <Stop offset="1" stopColor="#23b33a" />
      </LinearGradient>
    </Defs>
    <Path 
      d="M87.184 25.227c-33.733 0-61.166 27.423-61.178 61.13a60.98 60.98 0 009.349 32.535l1.455 2.313-6.179 22.558 23.146-6.069 2.235 1.324a60.95 60.95 0 0031.29 8.57c33.754 0 61.178-27.444 61.178-61.156a60.8 60.8 0 00-17.895-43.251 60.8 60.8 0 00-43.401-17.954z" 
      fill="url(#waGradient)" 
    />
    <Path 
      d="M68.772 55.603c-1.378-3.061-2.828-3.123-4.137-3.176l-3.524-.043a6.76 6.76 0 00-4.894 2.3c-1.682 1.837-6.426 6.278-6.426 15.312s6.578 17.765 7.497 18.99 12.701 20.326 31.346 27.7c15.518 6.138 18.689 4.918 22.061 4.611s10.877-4.447 12.408-8.74 1.532-7.977 1.073-8.74-1.685-1.226-3.525-2.146-10.877-5.367-12.56-5.981-2.91-.918-4.137.92-4.746 5.979-5.819 7.206-2.144 1.381-3.984.462-7.76-2.861-14.784-9.124c-5.465-4.873-9.154-10.891-10.228-12.73s-.114-2.835.808-3.751c.825-.824 1.838-2.147 2.759-3.22s1.224-1.837 1.836-3.064.307-2.301-.153-3.22-4.032-10.011-5.666-13.647" 
      fill="#fff" 
      fillRule="evenodd" 
    />
  </Svg>
);

const InstagramIcon = ({ size = 24 }: { size?: number }) => (
  <Svg viewBox="0 0 24 24" width={size} height={size}>
    <Defs>
      <RadialGradient id="igGradient" cx="0.3" cy="1.1" r="1">
        <Stop offset="0" stopColor="#fdf497" />
        <Stop offset="0.05" stopColor="#fdf497" />
        <Stop offset="0.45" stopColor="#fd5949" />
        <Stop offset="0.6" stopColor="#d6249f" />
        <Stop offset="0.9" stopColor="#285AEB" />
      </RadialGradient>
    </Defs>
    <Rect x="2" y="2" width="20" height="20" rx="5" fill="url(#igGradient)" />
    <Circle cx="12" cy="12" r="4.2" fill="none" stroke="#fff" strokeWidth="1.6" />
    <Circle cx="17.6" cy="6.4" r="1.1" fill="#fff" />
  </Svg>
);

const LinkedInIcon = ({ size = 24 }: { size?: number }) => (
  <Svg viewBox="0 0 24 24" width={size} height={size}>
    <Path 
      d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" 
      fill="#0A66C2" 
    />
  </Svg>
);

const GoogleIcon = ({ size = 24 }: { size?: number }) => (
  <Svg viewBox="0 0 24 24" width={size} height={size}>
    <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
    <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </Svg>
);

const MicrosoftIcon = ({ size = 24 }: { size?: number }) => (
  <Svg viewBox="0 0 24 24" width={size} height={size}>
    <Rect x="1" y="1" width="10" height="10" fill="#F25022"/>
    <Rect x="13" y="1" width="10" height="10" fill="#7FBA00"/>
    <Rect x="1" y="13" width="10" height="10" fill="#00A4EF"/>
    <Rect x="13" y="13" width="10" height="10" fill="#FFB900"/>
  </Svg>
);

const GoHighLevelIcon = ({ size = 24 }: { size?: number }) => (
  <Svg viewBox="0 0 120 120" width={size} height={size}>
    <Polygon points="15,100 27,100 27,60 15,60" fill="#FFB902" />
    <Polygon points="7,60 35,60 21,30" fill="#FFB902" />
    <Polygon points="21,30 35,60 28,60 28,42" fill="#E0A300" />
    <Polygon points="40,100 52,100 52,55 40,55" fill="#0B81FF" />
    <Polygon points="32,55 60,55 46,22" fill="#0B81FF" />
    <Polygon points="46,22 60,55 53,55 53,36" fill="#0066CC" />
    <Polygon points="65,100 77,100 77,48 65,48" fill="#00C853" />
    <Polygon points="57,48 85,48 71,12" fill="#00C853" />
    <Polygon points="71,12 85,48 78,48 78,28" fill="#009624" />
  </Svg>
);

const SlackIcon = ({ size = 24 }: { size?: number }) => (
  <Svg viewBox="0 0 54 54" width={size} height={size}>
    <Path fill="#E01E5A" d="M19.712.133a5.381 5.381 0 0 0-5.376 5.387 5.381 5.381 0 0 0 5.376 5.386h5.376V5.52A5.381 5.381 0 0 0 19.712.133m0 14.365H5.376A5.381 5.381 0 0 0 0 19.884a5.381 5.381 0 0 0 5.376 5.387h14.336a5.381 5.381 0 0 0 5.376-5.387 5.381 5.381 0 0 0-5.376-5.386"/>
    <Path fill="#36C5F0" d="M53.76 19.884a5.381 5.381 0 0 0-5.376-5.386 5.381 5.381 0 0 0-5.376 5.386v5.387h5.376a5.381 5.381 0 0 0 5.376-5.387m-14.336 0V5.52A5.381 5.381 0 0 0 34.048.133a5.381 5.381 0 0 0-5.376 5.387v14.364a5.381 5.381 0 0 0 5.376 5.387 5.381 5.381 0 0 0 5.376-5.387"/>
    <Path fill="#2EB67D" d="M34.048 54a5.381 5.381 0 0 0 5.376-5.387 5.381 5.381 0 0 0-5.376-5.386h-5.376v5.386A5.381 5.381 0 0 0 34.048 54m0-14.365h14.336a5.381 5.381 0 0 0 5.376-5.386 5.381 5.381 0 0 0-5.376-5.387H34.048a5.381 5.381 0 0 0-5.376 5.387 5.381 5.381 0 0 0 5.376 5.386"/>
    <Path fill="#ECB22E" d="M0 34.249a5.381 5.381 0 0 0 5.376 5.386 5.381 5.381 0 0 0 5.376-5.386v-5.387H5.376A5.381 5.381 0 0 0 0 34.25m14.336 0v14.364a5.381 5.381 0 0 0 5.376 5.387 5.381 5.381 0 0 0 5.376-5.387V34.25a5.381 5.381 0 0 0-5.376-5.387 5.381 5.381 0 0 0-5.376 5.387"/>
  </Svg>
);

// ── BRAND METADATA MAP ──────────────────────────────────────────────────────

interface IntegrationMeta {
  description: string;
  category: string;
  iconBg: string;
  iconBgDark: string;
}

const INTEGRATION_METADATA: Record<string, IntegrationMeta> = {
  'WhatsApp API Agent': {
    description: 'Configure your WhatsApp Business API account for AI-powered conversations.',
    category: 'AI & Messaging',
    iconBg: '#E8F5E9',
    iconBgDark: 'rgba(35, 179, 58, 0.12)',
  },
  'WhatsApp Personal': {
    description: 'Connect your personal WhatsApp number via QR code for direct messaging.',
    category: 'Messaging',
    iconBg: '#E8F5E9',
    iconBgDark: 'rgba(35, 179, 58, 0.12)',
  },
  'Instagram': {
    description: 'Connect Instagram for AI-powered DMs, comments, and lead capture.',
    category: 'Social',
    iconBg: '#FCE4EC',
    iconBgDark: 'rgba(214, 36, 159, 0.12)',
  },
  'LinkedIn': {
    description: 'Connect LinkedIn to sync leads and manage outreach campaigns.',
    category: 'Social',
    iconBg: '#E3F2FD',
    iconBgDark: 'rgba(13, 71, 161, 0.15)',
  },
  'Google/Gmail': {
    description: 'Connect Google Calendar, Drive, Sheets, Gmail, and Analytics.',
    category: 'Email & Calendar',
    iconBg: '#ECEFF1',
    iconBgDark: 'rgba(255, 255, 255, 0.08)',
  },
  'Microsoft/Outlook': {
    description: 'Connect Outlook calendar and email for scheduling and communication.',
    category: 'Email & Calendar',
    iconBg: '#E3F2FD',
    iconBgDark: 'rgba(0, 164, 239, 0.15)',
  },
  'Custom Email (SMTP)': {
    description: 'Connect Roundcube, cPanel mail, Zoho, Yandex, Fastmail, or any self-hosted webmail.',
    category: 'Email & Calendar',
    iconBg: '#E0F2F1',
    iconBgDark: 'rgba(0, 150, 136, 0.12)',
  },
  'GoHighLevel': {
    description: 'Connect GoHighLevel CRM to sync contacts, deals, and automate workflows.',
    category: 'CRM',
    iconBg: '#FFF9C4',
    iconBgDark: 'rgba(255, 185, 2, 0.12)',
  },
  'MindBody': {
    description: 'Connect MindBody to automate trial class booking via WhatsApp AI.',
    category: 'CRM',
    iconBg: '#E0F2F1',
    iconBgDark: 'rgba(0, 150, 136, 0.12)',
  },
  'Route Magic': {
    description: 'Connect Route Magic ERP to sync customers as leads and create sale orders from WhatsApp.',
    category: 'CRM',
    iconBg: '#E8F5E9',
    iconBgDark: 'rgba(35, 179, 58, 0.12)',
  },
  'Slack': {
    description: 'Receive real-time business updates and notifications in your workspace.',
    category: 'Collaboration',
    iconBg: '#F3E5F5',
    iconBgDark: 'rgba(156, 39, 176, 0.12)',
  },
};

// ── COMPONENT OVERHAUL ──────────────────────────────────────────────────────

export default function IntegrationsScreen() {
  const insets = useSafeAreaInsets();
  const appTheme = useAppTheme();
  const navigation = useNavigation();
  
  // View states: 'grid' or integration key
  const [activeView, setActiveView] = useState<string>('grid');

  // Intercept back actions when inside a subview to return to the grid view
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (activeView !== 'grid') {
        e.preventDefault();
        setActiveView('grid');
      }
    });
    return unsubscribe;
  }, [navigation, activeView]);

  // Dynamically update Stack Header title based on activeView
  useEffect(() => {
    let title = 'Integrations';
    if (activeView === 'whatsapp-ai') title = 'WhatsApp API Agent';
    else if (activeView === 'whatsapp-personal') title = 'WhatsApp Personal';
    else if (activeView === 'google') title = 'Google/Gmail';
    else if (activeView === 'microsoft') title = 'Microsoft/Outlook';
    else if (activeView === 'custom-email') title = 'Custom Email (SMTP)';
    else if (activeView === 'gohighlevel') title = 'GoHighLevel';
    else if (activeView === 'mindbody') title = 'MindBody';
    else if (activeView === 'routemagic') title = 'Route Magic';
    else if (activeView === 'linkedin') title = 'LinkedIn';
    else if (activeView === 'slack') title = 'Slack';
    else if (activeView === 'instagram') title = 'Instagram';

    navigation.setOptions({ title });
  }, [activeView, navigation]);
  
  const [integrations, setIntegrations] = useState<ConnectedIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (asRefresh = false) => {
    if (asRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const summary = await getConnectedIntegrations();
      
      const defaultList: ConnectedIntegration[] = [
        { channel: 'whatsapp', label: 'WhatsApp API Agent', connected: false, status: 'disconnected' },
        { channel: 'whatsapp', label: 'WhatsApp Personal', connected: false, status: 'disconnected' },
        { channel: 'linkedin', label: 'LinkedIn', connected: false, status: 'disconnected' },
        { channel: 'email', label: 'Google/Gmail', connected: false, status: 'disconnected' },
        { channel: 'email', label: 'Microsoft/Outlook', connected: false, status: 'disconnected' },
        { channel: 'instagram', label: 'Instagram', connected: false, status: 'disconnected' },
        { channel: 'gohighlevel', label: 'GoHighLevel', connected: false, status: 'disconnected' },
        { channel: 'mindbody', label: 'MindBody', connected: false, status: 'disconnected' },
        { channel: 'routemagic', label: 'Route Magic', connected: false, status: 'disconnected' },
        { channel: 'custom-email', label: 'Custom Email (SMTP)', connected: false, status: 'disconnected' },
        { channel: 'slack', label: 'Slack', connected: false, status: 'disconnected' },
      ];

      const apiResults = summary.integrations || [];
      const merged = defaultList.map(def => {
        const found = apiResults.find(a => 
          a.label === def.label || 
          (a.channel === def.channel && a.channel !== 'whatsapp' && a.channel !== 'email')
        );
        return found ? { ...def, ...found } : def;
      });

      setIntegrations(merged);
    } catch (err) {
      setError('Failed to load integrations.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getIcon = (channel: string, label: string, color: string) => {
    switch (channel.toLowerCase()) {
      case 'whatsapp': 
        return <WhatsAppIcon size={24} />;
      case 'email': 
        if (label.toLowerCase().includes('google')) {
          return <GoogleIcon size={24} />;
        }
        return <MicrosoftIcon size={24} />;
      case 'linkedin': 
        return <LinkedInIcon size={24} />;
      case 'instagram': 
        return <InstagramIcon size={24} />;
      case 'gohighlevel': 
        return <GoHighLevelIcon size={24} />;
      case 'mindbody':
        return <Typography variant="h3" style={{ fontSize: 24, textAlign: 'center' }}>🧘</Typography>;
      case 'routemagic':
        return <Truck color="#047857" size={24} />;
      case 'custom-email':
        return <Server color="#059669" size={24} />;
      case 'slack':
        return <SlackIcon size={24} />;
      default:
        return <LinkIcon color={color} size={24} />;
    }
  };

  const handleConnect = (integration: ConnectedIntegration) => {
    const label = integration.label;
    if (label === 'WhatsApp API Agent') setActiveView('whatsapp-ai');
    else if (label === 'WhatsApp Personal') setActiveView('whatsapp-personal');
    else if (label === 'LinkedIn') setActiveView('linkedin');
    else if (label === 'Google/Gmail') setActiveView('google');
    else if (label === 'Microsoft/Outlook') setActiveView('microsoft');
    else if (label === 'Instagram') setActiveView('instagram');
    else if (label === 'GoHighLevel') setActiveView('gohighlevel');
    else if (label === 'MindBody') setActiveView('mindbody');
    else if (label === 'Route Magic') setActiveView('routemagic');
    else if (label === 'Custom Email (SMTP)') setActiveView('custom-email');
    else if (label === 'Slack') setActiveView('slack');
  };

  // ── RENDER LOADING STATE (Premium Shimmer Skeleton) ───────────────────────
  if (loading && activeView === 'grid') {
    return (
      <AnimatedScreen style={[styles.container, { backgroundColor: appTheme.background }]}>
        <View style={[styles.header, { marginTop: insets.top + Theme.spacing.md }]}>
          <View style={styles.headerText}>
            <Typography variant="h2" color={appTheme.text} style={{ fontWeight: '500' }}>Integrations</Typography>
            <Typography variant="body" color={appTheme.muted}>
              Connect your favorite applications for seamless, automated workflows.
            </Typography>
          </View>
        </View>
        <ScrollView 
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 80 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.grid}>
            {[1, 2, 3, 4].map((key) => (
              <GlassCard key={key} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <SkeletonBlock style={styles.iconSkeleton} borderRadius={12} />
                    <View style={styles.titleContainer}>
                      <SkeletonBlock style={{ width: 70, height: 10, marginBottom: 6 }} borderRadius={4} />
                      <SkeletonBlock style={{ width: 140, height: 16 }} borderRadius={4} />
                    </View>
                  </View>
                  <SkeletonBlock style={{ width: 85, height: 20 }} borderRadius={6} />
                </View>
                <View style={styles.cardBody}>
                  <SkeletonBlock style={{ width: '100%', height: 12, marginBottom: 6 }} borderRadius={4} />
                  <SkeletonBlock style={{ width: '85%', height: 12 }} borderRadius={4} />
                </View>
                <SkeletonBlock style={{ height: 40, width: '100%' }} borderRadius={Theme.radius.md} />
              </GlassCard>
            ))}
          </View>
        </ScrollView>
      </AnimatedScreen>
    );
  }

  // ── RENDER DETAIL SUBVIEWS ─────────────────────────────────────────────────

  const renderDetailView = () => {
    switch (activeView) {
      case 'whatsapp-ai':
        return <WhatsAppAiDetailView onBack={() => { setActiveView('grid'); loadData(); }} />;
      case 'whatsapp-personal':
        return <WhatsAppPersonalDetailView onBack={() => { setActiveView('grid'); loadData(); }} />;
      case 'google':
        return <EmailOAuthDetailView provider="google" label="Google/Gmail" onBack={() => { setActiveView('grid'); loadData(); }} />;
      case 'microsoft':
        return <EmailOAuthDetailView provider="microsoft" label="Microsoft/Outlook" onBack={() => { setActiveView('grid'); loadData(); }} />;
      case 'custom-email':
        return <CustomEmailDetailView onBack={() => { setActiveView('grid'); loadData(); }} />;
      case 'gohighlevel':
        return <GoHighLevelDetailView onBack={() => { setActiveView('grid'); loadData(); }} />;
      case 'mindbody':
        return <MindBodyDetailView onBack={() => { setActiveView('grid'); loadData(); }} />;
      case 'routemagic':
        return <RouteMagicDetailView onBack={() => { setActiveView('grid'); loadData(); }} />;
      case 'linkedin':
        return <LinkedInDetailView onBack={() => { setActiveView('grid'); loadData(); }} />;
      case 'slack':
        return (
          <View style={styles.comingSoonContainer}>
            <TouchableOpacity style={styles.backLink} onPress={() => setActiveView('grid')}>
              <ArrowLeft color={appTheme.text} size={16} />
              <Typography variant="bodySmall" color={appTheme.text} style={{ marginLeft: 6 }}>Back to Integrations</Typography>
            </TouchableOpacity>
            <GlassCard style={styles.detailCard}>
              <Typography variant="h3" style={{ marginBottom: 8 }}>Slack Integration</Typography>
              <Typography variant="body" color={appTheme.muted}>Slack integration is coming soon to the mobile app.</Typography>
            </GlassCard>
          </View>
        );
      case 'instagram':
        return (
          <View style={styles.comingSoonContainer}>
            <TouchableOpacity style={styles.backLink} onPress={() => setActiveView('grid')}>
              <ArrowLeft color={appTheme.text} size={16} />
              <Typography variant="bodySmall" color={appTheme.text} style={{ marginLeft: 6 }}>Back to Integrations</Typography>
            </TouchableOpacity>
            <GlassCard style={styles.detailCard}>
              <Typography variant="h3" style={{ marginBottom: 8 }}>Instagram Integration</Typography>
              <Typography variant="body" color={appTheme.muted} style={{ marginBottom: 16 }}>
                Instagram settings can be managed directly on the Web dashboard for meta account integrations.
              </Typography>
              <TouchableOpacity 
                style={[styles.actionButton, styles.primaryButton, { backgroundColor: appTheme.primaryAccent }]}
                onPress={() => Linking.openURL('https://techiemaya.com/settings?tab=integrations')}
              >
                <ExternalLink color="#fff" size={15} style={{ marginRight: 6 }} />
                <Typography variant="bodySmall" color="#fff" style={{ fontWeight: '500' }}>Open Web Setup</Typography>
              </TouchableOpacity>
            </GlassCard>
          </View>
        );
      default:
        return null;
    }
  };

  if (activeView !== 'grid') {
    return (
      <AnimatedScreen style={[styles.container, { backgroundColor: appTheme.background }]}>
        <ScrollView 
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + Theme.spacing.md, paddingBottom: insets.bottom + 80 }]}
          showsVerticalScrollIndicator={false}
        >
          {renderDetailView()}
        </ScrollView>
      </AnimatedScreen>
    );
  }

  // ── RENDER LIVE UI (Grid View) ─────────────────────────────────────────────
  return (
    <AnimatedScreen style={[styles.container, { backgroundColor: appTheme.background }]}>
      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + Theme.spacing.md, paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Typography variant="h2" color={appTheme.text} style={{ fontWeight: '500' }}>Integrations</Typography>
            <Typography variant="body" color={appTheme.muted}>
              Connect your favorite applications for seamless, automated workflows.
            </Typography>
          </View>
          <TouchableOpacity 
            style={[styles.refreshButton, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]} 
            onPress={() => loadData(true)}
            activeOpacity={0.7}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={appTheme.primaryAccent} />
            ) : (
              <RefreshCw color={appTheme.primaryAccent} size={18} />
            )}
          </TouchableOpacity>
        </View>

        {error && (
          <GlassCard style={[styles.messageCard, { borderColor: Theme.colors.error }]}>
            <AlertCircle color={Theme.colors.error} size={20} />
            <Typography variant="bodySmall" color={Theme.colors.error} style={{ marginLeft: 8 }}>{error}</Typography>
          </GlassCard>
        )}

        <View style={styles.grid}>
          {integrations.map((item, idx) => {
            const isConnected = item.connected;
            const hasError = item.status === 'error' || item.status === 'checkpoint';
            const isComingSoon = item.label === 'Slack';
            
            const meta = INTEGRATION_METADATA[item.label] || {
              description: 'Connect this app to LAD to automate and synchronize data settings.',
              category: 'Integration',
              iconBg: '#F3F4F6',
              iconBgDark: 'rgba(255, 255, 255, 0.05)'
            };

            const wrapperBg = appTheme.darkMode ? meta.iconBgDark : meta.iconBg;

            return (
              <TouchableOpacity
                key={`${item.label}-${idx}`}
                onPress={() => !isComingSoon && handleConnect(item)}
                disabled={isComingSoon}
                activeOpacity={0.85}
              >
                <GlassCard style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                      <View style={[styles.iconWrapper, { backgroundColor: wrapperBg }]}>
                        {getIcon(item.channel, item.label, appTheme.primaryAccent)}
                      </View>
                      <View style={styles.titleContainer}>
                        <Typography variant="overline" color={appTheme.muted} style={styles.categoryText}>
                          {meta.category}
                        </Typography>
                        <Typography variant="h4" color={appTheme.text} style={[styles.cardTitle, { fontWeight: '500' }]}>
                          {item.label}
                        </Typography>
                      </View>
                    </View>
                    <View style={styles.cardHeaderRight}>
                      {isComingSoon ? (
                        <Badge label="Coming Soon" variant="default" />
                      ) : isConnected ? (
                        <Badge label="Connected" variant="success" />
                      ) : hasError ? (
                        <Badge label="Requires Action" variant="warning" />
                      ) : (
                        <Badge label="Disconnected" variant="default" />
                      )}
                    </View>
                  </View>

                  <View style={styles.cardBody}>
                    <Typography variant="bodySmall" color={appTheme.muted} style={styles.descriptionText}>
                      {meta.description}
                    </Typography>

                    {isConnected && (item.accountName || item.email) && (
                      <View style={[styles.accountBadgeContainer, { backgroundColor: appTheme.softSurface, borderColor: appTheme.border }]}>
                        <CheckCircle2 color={appTheme.success} size={13} style={{ marginRight: 6 }} />
                        <Typography variant="caption" color={appTheme.text} style={styles.accountText} numberOfLines={1}>
                          {item.accountName || item.email}
                        </Typography>
                      </View>
                    )}
                  </View>

                  <View style={styles.cardFooter}>
                    {isComingSoon ? (
                      <View style={[styles.actionButton, styles.disabledButton, { backgroundColor: appTheme.softSurface }]}>
                        <Typography variant="bodySmall" color={appTheme.disabled} style={[styles.buttonText, { fontWeight: '500' }]}>
                          Coming Soon
                        </Typography>
                      </View>
                    ) : isConnected ? (
                      <View 
                        style={[styles.actionButton, styles.secondaryButton, { borderColor: appTheme.border }]}
                      >
                        <Settings2 color={appTheme.text} size={15} style={{ marginRight: 6 }} />
                        <Typography variant="bodySmall" color={appTheme.text} style={[styles.buttonText, { fontWeight: '500' }]}>
                          Configure Connection
                        </Typography>
                      </View>
                    ) : (
                      <View 
                        style={[styles.actionButton, styles.primaryButton, { backgroundColor: appTheme.primaryAccent }]}
                      >
                        <LinkIcon color={appTheme.darkMode ? '#0F172A' : '#FFFFFF'} size={15} style={{ marginRight: 6 }} />
                        <Typography 
                          variant="bodySmall" 
                          color={appTheme.darkMode ? '#0F172A' : '#FFFFFF'} 
                          style={[styles.buttonText, { fontWeight: '500' }]}
                        >
                          Connect Integration
                        </Typography>
                      </View>
                    )}
                  </View>
                </GlassCard>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </AnimatedScreen>
  );
}

// ── 1. WHATSAPP API AGENT DETAIL SUBVIEW ────────────────────────────────────

interface WhatsAppAccount {
  id: string;
  tenant_id: string;
  slug: string;
  display_name: string;
  ai_model: string;
  timezone: string;
  status: string;
  conversation_flow_template: string;
  phone_number_id: string | null;
  business_account_id: string | null;
}

const WABA_FLOW_TEMPLATES = [
  { id: 'generic', label: 'Generic', description: 'Universal AI assistant' },
  { id: 'bni', label: 'BNI', description: 'BNI chapter networking flow' },
  { id: 'real_estate', label: 'Real Estate', description: 'Property inquiries & scheduling' },
  { id: 'ecommerce', label: 'E-Commerce', description: 'Product catalog & orders' },
];

const WABA_AI_MODELS = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { id: 'gpt-4o', label: 'GPT-4o' },
];

const WABA_TIMEZONES = ['UTC', 'US/Eastern', 'US/Central', 'US/Pacific', 'Europe/London', 'Europe/Berlin', 'Asia/Kolkata', 'Asia/Singapore', 'Australia/Sydney'];

function WhatsAppAiDetailView({ onBack }: { onBack: () => void }) {
  const appTheme = useAppTheme();
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedAccount, setExpandedAccount] = useState<string | null>(null);
  
  // Onboard form state
  const [displayName, setDisplayName] = useState('');
  const [slug, setSlug] = useState('');
  const [dbUrl, setDbUrl] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [phoneId, setPhoneId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [businessAccountId, setBusinessAccountId] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [appId, setAppId] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [aiModel, setAiModel] = useState('gemini-2.5-flash');
  const [aiApiKey, setAiApiKey] = useState('');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [flowTemplate, setFlowTemplate] = useState('generic');
  const [escalationPhone, setEscalationPhone] = useState('');
  
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<any>('/api/whatsapp-conversations/admin/whatsapp-accounts');
      const data = res.data;
      if (data && data.success) {
        setAccounts(Array.isArray(data.data) ? data.data : []);
      } else if (Array.isArray(data)) {
        setAccounts(data);
      }
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const handleNameChange = (val: string) => {
    setDisplayName(val);
    const generated = val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    setSlug(generated);
  };

  const handleCreate = async () => {
    if (!displayName.trim() || !slug.trim() || !dbUrl.trim()) {
      Alert.alert('Required Fields', 'Display name, slug, and database URL are required.');
      return;
    }
    setSubmitting(true);
    setActionError(null);
    try {
      const payload: Record<string, any> = {
        display_name: displayName,
        slug,
        database_url: dbUrl,
        tenant_id: tenantId || undefined,
        phone_number_id: phoneId || undefined,
        access_token: accessToken || undefined,
        business_account_id: businessAccountId || undefined,
        verify_token: verifyToken || undefined,
        app_id: appId || undefined,
        app_secret: appSecret || undefined,
        ai_model: aiModel,
        ai_api_key: aiApiKey || undefined,
        timezone,
        conversation_flow_template: flowTemplate,
        escalation_phone: escalationPhone || undefined,
      };

      const res = await apiPost<any>('/api/whatsapp-conversations/admin/whatsapp-accounts', payload);
      if (res.data && res.data.success) {
        Alert.alert('Success', 'WhatsApp API Account onboarded successfully.');
        setShowForm(false);
        // Clear form
        setDisplayName('');
        setSlug('');
        setDbUrl('');
        setTenantId('');
        setPhoneId('');
        setAccessToken('');
        setBusinessAccountId('');
        setVerifyToken('');
        setAppId('');
        setAppSecret('');
        setAiApiKey('');
        setEscalationPhone('');
        loadAccounts();
      } else {
        setActionError(res.data?.error || 'Failed to onboard account.');
      }
    } catch (e: any) {
      setActionError(e.message || 'Error occurred during creation.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (accountSlug: string, name: string) => {
    Alert.alert(
      'Deactivate Account',
      `Are you sure you want to deactivate "${name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Deactivate', 
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await apiDelete<any>(`/api/whatsapp-conversations/admin/whatsapp-accounts/${encodeURIComponent(accountSlug)}`);
              if (res.data && res.data.success) {
                Alert.alert('Deactivated', `"${name}" has been deactivated.`);
                loadAccounts();
              } else {
                Alert.alert('Error', res.data?.error || 'Failed to deactivate.');
              }
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Connection failed.');
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.detailContainer}>
      <TouchableOpacity style={styles.backLink} onPress={onBack}>
        <ArrowLeft color={appTheme.text} size={16} />
        <Typography variant="bodySmall" color={appTheme.text} style={{ marginLeft: 6 }}>Back to Integrations</Typography>
      </TouchableOpacity>

      <View style={styles.detailTitleRow}>
        <View style={styles.detailTitleWrapper}>
          <WhatsAppIcon size={32} />
          <View style={{ marginLeft: 12 }}>
            <Typography variant="h3" color={appTheme.text} style={{ fontWeight: '500' }}>WhatsApp API Agent</Typography>
            <Typography variant="caption" color={appTheme.muted}>AI-powered Cloud API connections</Typography>
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.subRefreshButton, { borderColor: appTheme.border }]} 
          onPress={loadAccounts}
        >
          <RefreshCw color={appTheme.primaryAccent} size={14} />
        </TouchableOpacity>
      </View>

      {/* Accounts List */}
      <GlassCard style={styles.detailCard}>
        <View style={styles.cardTitleHeader}>
          <Typography variant="body" style={{ fontWeight: '600' }}>Accounts List ({accounts.length})</Typography>
          {!showForm && (
            <TouchableOpacity 
              style={[styles.smallAddButton, { backgroundColor: appTheme.primarySoft }]}
              onPress={() => setShowForm(true)}
            >
              <Plus color={appTheme.primaryAccent} size={14} />
              <Typography variant="caption" color={appTheme.primaryAccent} style={{ marginLeft: 4, fontWeight: '600' }}>New Account</Typography>
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <ActivityIndicator size="small" color={appTheme.primaryAccent} style={{ paddingVertical: 20 }} />
        ) : accounts.length === 0 ? (
          <View style={styles.emptyAccounts}>
            <Globe color={appTheme.muted} size={28} style={{ marginBottom: 8, opacity: 0.5 }} />
            <Typography variant="bodySmall" color={appTheme.muted}>No WhatsApp Cloud accounts configured.</Typography>
          </View>
        ) : (
          <View style={styles.accountsList}>
            {accounts.map(acc => {
              const isExpanded = expandedAccount === acc.slug;
              const isActive = acc.status === 'active';

              return (
                <View key={acc.slug} style={[styles.accountItem, { borderBottomColor: appTheme.border }]}>
                  <TouchableOpacity 
                    style={styles.accountItemHeader}
                    onPress={() => setExpandedAccount(isExpanded ? null : acc.slug)}
                  >
                    <View style={styles.accountItemHeaderLeft}>
                      {isExpanded ? <ChevronDown size={16} color={appTheme.muted} /> : <ChevronRight size={16} color={appTheme.muted} />}
                      <View style={{ marginLeft: 8, flex: 1 }}>
                        <Typography variant="bodySmall" style={{ fontWeight: '600' }} numberOfLines={1}>{acc.display_name}</Typography>
                        <Typography variant="caption" color={appTheme.muted} style={{ fontSize: 10 }}>/webhook/{acc.slug}</Typography>
                      </View>
                    </View>

                    <View style={styles.accountItemHeaderRight}>
                      <Badge label={isActive ? 'Active' : 'Inactive'} variant={isActive ? 'success' : 'default'} style={{ marginRight: 6 }} />
                      <Badge label={acc.conversation_flow_template} variant="default" />
                      {isActive && (
                        <TouchableOpacity 
                          style={{ marginLeft: 10, padding: 4 }}
                          onPress={() => handleDeactivate(acc.slug, acc.display_name)}
                        >
                          <Trash2 size={14} color={Theme.colors.error} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={[styles.accountExpanded, { backgroundColor: appTheme.softSurface }]}>
                      <View style={styles.detailsGrid}>
                        <View style={styles.detailGridItem}>
                          <Typography variant="overline" style={{ fontSize: 9 }} color={appTheme.muted}>Tenant ID</Typography>
                          <Typography variant="caption" numberOfLines={1}>{acc.tenant_id}</Typography>
                        </View>
                        <View style={styles.detailGridItem}>
                          <Typography variant="overline" style={{ fontSize: 9 }} color={appTheme.muted}>Account ID</Typography>
                          <Typography variant="caption" numberOfLines={1}>{acc.id}</Typography>
                        </View>
                        <View style={styles.detailGridItem}>
                          <Typography variant="overline" style={{ fontSize: 9 }} color={appTheme.muted}>Phone ID</Typography>
                          <Typography variant="caption">{acc.phone_number_id || '—'}</Typography>
                        </View>
                        <View style={styles.detailGridItem}>
                          <Typography variant="overline" style={{ fontSize: 9 }} color={appTheme.muted}>Business ID</Typography>
                          <Typography variant="caption">{acc.business_account_id || '—'}</Typography>
                        </View>
                        <View style={styles.detailGridItem}>
                          <Typography variant="overline" style={{ fontSize: 9 }} color={appTheme.muted}>AI Model</Typography>
                          <Typography variant="caption">{acc.ai_model}</Typography>
                        </View>
                        <View style={styles.detailGridItem}>
                          <Typography variant="overline" style={{ fontSize: 9 }} color={appTheme.muted}>Timezone</Typography>
                          <Typography variant="caption">{acc.timezone}</Typography>
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </GlassCard>

      {/* Onboard Form */}
      {showForm && (
        <GlassCard style={[styles.detailCard, { backgroundColor: appTheme.softSurface }]}>
          <View style={[styles.cardTitleHeader, { marginBottom: 12 }]}>
            <Typography variant="body" style={{ fontWeight: '600' }}>Onboard New Account</Typography>
            <TouchableOpacity onPress={() => setShowForm(false)}>
              <Typography variant="caption" color={appTheme.muted}>Cancel</Typography>
            </TouchableOpacity>
          </View>

          {actionError && (
            <View style={[styles.errorBanner, { borderColor: Theme.colors.error }]}>
              <AlertCircle size={14} color={Theme.colors.error} />
              <Typography variant="caption" color={Theme.colors.error} style={{ marginLeft: 6, flex: 1 }}>{actionError}</Typography>
            </View>
          )}

          <View style={styles.formFields}>
            <View style={styles.formRow}>
              <View style={styles.formCol}>
                <Typography variant="caption" color={appTheme.muted}>Display Name *</Typography>
                <TextInput 
                  style={[styles.mobileInput, { backgroundColor: appTheme.input, color: appTheme.text, borderColor: appTheme.border }]} 
                  value={displayName} 
                  onChangeText={handleNameChange}
                  placeholder="e.g. Acme Business"
                  placeholderTextColor={appTheme.disabled}
                />
              </View>
              <View style={styles.formCol}>
                <Typography variant="caption" color={appTheme.muted}>Slug *</Typography>
                <TextInput 
                  style={[styles.mobileInput, { backgroundColor: appTheme.input, color: appTheme.text, borderColor: appTheme.border }]} 
                  value={slug} 
                  onChangeText={setSlug}
                  placeholder="acme-business"
                  placeholderTextColor={appTheme.disabled}
                />
              </View>
            </View>

            <View style={styles.formCol}>
              <Typography variant="caption" color={appTheme.muted}>Database URL *</Typography>
              <TextInput 
                style={[styles.mobileInput, { backgroundColor: appTheme.input, color: appTheme.text, borderColor: appTheme.border }]} 
                value={dbUrl} 
                onChangeText={setDbUrl}
                placeholder="postgresql://user:pass@host:5432/dbname"
                placeholderTextColor={appTheme.disabled}
              />
            </View>

            <View style={styles.formCol}>
              <Typography variant="caption" color={appTheme.muted}>Tenant ID (optional)</Typography>
              <TextInput 
                style={[styles.mobileInput, { backgroundColor: appTheme.input, color: appTheme.text, borderColor: appTheme.border }]} 
                value={tenantId} 
                onChangeText={setTenantId}
                placeholder="LAD Tenant UUID"
                placeholderTextColor={appTheme.disabled}
              />
            </View>

            <View style={styles.formRow}>
              <View style={styles.formCol}>
                <Typography variant="caption" color={appTheme.muted}>AI Model</Typography>
                <TextInput 
                  style={[styles.mobileInput, { backgroundColor: appTheme.input, color: appTheme.text, borderColor: appTheme.border }]} 
                  value={aiModel} 
                  onChangeText={setAiModel}
                  placeholder="gemini-2.5-flash"
                  placeholderTextColor={appTheme.disabled}
                />
              </View>
              <View style={styles.formCol}>
                <Typography variant="caption" color={appTheme.muted}>Timezone</Typography>
                <TextInput 
                  style={[styles.mobileInput, { backgroundColor: appTheme.input, color: appTheme.text, borderColor: appTheme.border }]} 
                  value={timezone} 
                  onChangeText={setTimezone}
                  placeholder="UTC"
                  placeholderTextColor={appTheme.disabled}
                />
              </View>
            </View>

            <View style={styles.formRow}>
              <View style={styles.formCol}>
                <Typography variant="caption" color={appTheme.muted}>Phone Number ID</Typography>
                <TextInput 
                  style={[styles.mobileInput, { backgroundColor: appTheme.input, color: appTheme.text, borderColor: appTheme.border }]} 
                  value={phoneId} 
                  onChangeText={setPhoneId}
                  placeholder="Meta phone ID"
                  placeholderTextColor={appTheme.disabled}
                />
              </View>
              <View style={styles.formCol}>
                <Typography variant="caption" color={appTheme.muted}>Access Token</Typography>
                <TextInput 
                  style={[styles.mobileInput, { backgroundColor: appTheme.input, color: appTheme.text, borderColor: appTheme.border }]} 
                  value={accessToken} 
                  onChangeText={setAccessToken}
                  secureTextEntry
                  placeholder="Cloud API token"
                  placeholderTextColor={appTheme.disabled}
                />
              </View>
            </View>

            <View style={styles.formRow}>
              <View style={styles.formCol}>
                <Typography variant="caption" color={appTheme.muted}>Business Account ID</Typography>
                <TextInput 
                  style={[styles.mobileInput, { backgroundColor: appTheme.input, color: appTheme.text, borderColor: appTheme.border }]} 
                  value={businessAccountId} 
                  onChangeText={setBusinessAccountId}
                  placeholder="Meta WABA ID"
                  placeholderTextColor={appTheme.disabled}
                />
              </View>
              <View style={styles.formCol}>
                <Typography variant="caption" color={appTheme.muted}>Verify Token</Typography>
                <TextInput 
                  style={[styles.mobileInput, { backgroundColor: appTheme.input, color: appTheme.text, borderColor: appTheme.border }]} 
                  value={verifyToken} 
                  onChangeText={setVerifyToken}
                  placeholder="Verify token"
                  placeholderTextColor={appTheme.disabled}
                />
              </View>
            </View>

            <View style={styles.formRow}>
              <View style={styles.formCol}>
                <Typography variant="caption" color={appTheme.muted}>App ID</Typography>
                <TextInput 
                  style={[styles.mobileInput, { backgroundColor: appTheme.input, color: appTheme.text, borderColor: appTheme.border }]} 
                  value={appId} 
                  onChangeText={setAppId}
                  placeholder="Facebook App ID"
                  placeholderTextColor={appTheme.disabled}
                />
              </View>
              <View style={styles.formCol}>
                <Typography variant="caption" color={appTheme.muted}>App Secret</Typography>
                <TextInput 
                  style={[styles.mobileInput, { backgroundColor: appTheme.input, color: appTheme.text, borderColor: appTheme.border }]} 
                  value={appSecret} 
                  onChangeText={setAppSecret}
                  secureTextEntry
                  placeholder="App Secret"
                  placeholderTextColor={appTheme.disabled}
                />
              </View>
            </View>

            <View style={styles.formCol}>
              <Typography variant="caption" color={appTheme.muted}>Human Escalation Phone (E.164)</Typography>
              <TextInput 
                style={[styles.mobileInput, { backgroundColor: appTheme.input, color: appTheme.text, borderColor: appTheme.border }]} 
                value={escalationPhone} 
                onChangeText={setEscalationPhone}
                placeholder="e.g. +971501234567"
                placeholderTextColor={appTheme.disabled}
              />
            </View>

            <TouchableOpacity 
              style={[styles.submitButton, { backgroundColor: appTheme.primaryAccent }]}
              onPress={handleCreate}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Typography variant="body" color={appTheme.darkMode ? '#0F172A' : '#fff'} style={{ fontWeight: '600' }}>Create Account</Typography>
              )}
            </TouchableOpacity>
          </View>
        </GlassCard>
      )}
    </View>
  );
}

// ── 2. WHATSAPP PERSONAL DETAIL SUBVIEW ─────────────────────────────────────

interface PersonalAccount {
  id: string;
  status: string;
  phone_number: string | null;
  connected_at: string | null;
  gateway_account_id: string | null;
  qr_code?: string;
  qr_expires_in?: number;
}

interface TeamMember {
  user_id: string;
  name: string;
  email: string;
  phone: string | null;
  active_count: number;
}

interface SyncedContact {
  phone: string;
  name: string | null;
  whatsapp_id: string | null;
  synced_at: string | null;
  is_saved: boolean;
}

function WhatsAppPersonalDetailView({ onBack }: { onBack: () => void }) {
  const appTheme = useAppTheme();
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'qr_scanning' | 'connected' | 'error'>('disconnected');
  const [account, setAccount] = useState<PersonalAccount | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timer, setTimer] = useState(0);

  // Auto-assign config state
  const [autoAssignEnabled, setAutoAssignEnabled] = useState(false);
  const [autoAssignSaving, setAutoAssignSaving] = useState(false);

  // Synced contacts state
  const [contacts, setContacts] = useState<SyncedContact[]>([]);
  const [contactsTotal, setContactsTotal] = useState(0);
  const [contactsPage, setContactsPage] = useState(1);
  const [contactsSearch, setContactsSearch] = useState('');
  const [contactsExpanded, setContactsExpanded] = useState(false);
  const [contactsLoading, setContactsLoading] = useState(false);

  // Team assign state
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamMembersLoading, setTeamMembersLoading] = useState(false);
  const [selectedTeamMemberId, setSelectedTeamMemberId] = useState('ai_agent');
  const [assignFilter, setAssignFilter] = useState<'all' | 'unassigned'>('unassigned');
  const [assigning, setAssigning] = useState(false);
  const [assignSuccess, setAssignSuccess] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  const loadContacts = useCallback(async (page = 1, search = '') => {
    setContactsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (search) params.set('search', search);
      const res = await apiGet<any>(`/api/personal-whatsapp/contacts?${params}`);
      if (res.data) {
        setContacts(res.data.contacts || res.data.data || []);
        setContactsTotal(res.data.total || 0);
        setContactsPage(res.data.page || 1);
      }
    } catch {
      // ignore
    } finally {
      setContactsLoading(false);
    }
  }, []);

  const loadTeamMembers = useCallback(async () => {
    setTeamMembersLoading(true);
    try {
      const res = await apiGet<any>('/api/personal-whatsapp/threads/team/workload');
      if (res.data && Array.isArray(res.data)) {
        setTeamMembers(res.data);
      }
    } catch {
      // ignore
    } finally {
      setTeamMembersLoading(false);
    }
  }, []);

  const restoreSession = useCallback(async () => {
    setLoading(true);
    try {
      // Get WAPA status config
      const statusRes = await apiGet<any>('/api/personal-whatsapp/accounts');
      const accountsList = Array.isArray(statusRes.data?.accounts) ? statusRes.data.accounts : (Array.isArray(statusRes.data) ? statusRes.data : []);
      const CONNECTED_STATUSES = ['connected', 'open', 'active', 'READY', 'ready'];
      const connectedAccount = accountsList.find((acc: any) => CONNECTED_STATUSES.includes(acc.status));
      if (connectedAccount) {
        setAccount(connectedAccount);
        setStatus('connected');
        loadContacts();
        loadTeamMembers();
      }

      // Get auto-assign config
      const assignRes = await apiGet<any>('/api/personal-whatsapp/auto-assign');
      if (assignRes.data && assignRes.data.data) {
        setAutoAssignEnabled(Boolean(assignRes.data.data.enabled));
      }
    } catch {
      setStatus('disconnected');
    } finally {
      setLoading(false);
    }
  }, [loadContacts, loadTeamMembers]);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  const startLogin = async () => {
    cleanup();
    setLoading(true);
    setError(null);
    setQrCode(null);
    setStatus('connecting');
    try {
      const res = await apiPost<any>('/api/personal-whatsapp/accounts', {});
      const result = res.data;
      if (!result || !result.id) {
        setError('Failed to generate QR. Ensure Personal WhatsApp service is running.');
        setStatus('error');
        setLoading(false);
        return;
      }

      setAccount(result);
      if (result.qr_code) {
        setQrCode(result.qr_code);
      }
      setStatus('qr_scanning');
      setLoading(false);

      const expiresIn = result.qr_expires_in || 240;
      setTimer(expiresIn);
      timerRef.current = setInterval(() => {
        setTimer((t) => {
          if (t <= 1) {
            cleanup();
            setQrCode(null);
            setStatus('disconnected');
            setError('QR code expired. Please generate a new QR.');
            return 0;
          }
          return t - 1;
        });
      }, 1000);

      pollRef.current = setInterval(async () => {
        try {
          const statusRes = await apiGet<any>(`/api/personal-whatsapp/accounts/${result.id}`);
          if (statusRes.data) {
            const statusResult = statusRes.data;
            const CONNECTED_STATUSES = ['connected', 'open', 'active', 'READY', 'ready'];
            if (CONNECTED_STATUSES.includes(statusResult.status)) {
              cleanup();
              setAccount(statusResult);
              setQrCode(null);
              setStatus('connected');
              loadContacts();
              loadTeamMembers();
            } else if (statusResult.status === 'error' || statusResult.status === 'disconnected' || statusResult.status === 'expired') {
              cleanup();
              setQrCode(null);
              setStatus('error');
              setError('Connection failed. Please try again.');
            }
          }
        } catch {
          // ignore
        }
      }, 3000);
    } catch (e: any) {
      setError(e.message || 'Error occurred starting personal connection.');
      setStatus('error');
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!account) return;
    setLoading(true);
    try {
      await apiPost('/api/personal-whatsapp/logout', { account_id: account.id, reason: 'user_requested' });
      cleanup();
      setAccount(null);
      setQrCode(null);
      setStatus('disconnected');
      setError(null);
    } catch {
      Alert.alert('Error', 'Failed to disconnect account.');
    } finally {
      setLoading(false);
    }
  };

  const handleAutoAssignToggle = async (value: boolean) => {
    setAutoAssignSaving(true);
    try {
      const res = await apiPut<any>('/api/personal-whatsapp/auto-assign', {
        enabled: value,
        saved_contacts_to: 'human_agent',
        unsaved_contacts_to: 'AI',
      });
      if (res.data && res.data.success) {
        setAutoAssignEnabled(value);
      }
    } catch {
      Alert.alert('Error', 'Failed to update auto-assign configuration.');
    } finally {
      setAutoAssignSaving(false);
    }
  };

  const handleAssignChats = async () => {
    setAssigning(true);
    setAssignSuccess(null);
    try {
      const targetUserId = selectedTeamMemberId === 'ai_agent' ? null : selectedTeamMemberId;
      const res = await apiPost<any>('/api/personal-whatsapp/conversations/bulk-assign', {
        user_id: targetUserId,
        filter: assignFilter,
        reason: targetUserId ? 'bulk_assign_settings' : 'bulk_release_to_ai',
      });
      if (res.data && res.data.success) {
        setAssignSuccess(
          selectedTeamMemberId === 'ai_agent'
            ? `Released ${res.data.assigned} chats back to the AI Agent.`
            : `Assigned ${res.data.assigned} chats successfully.`
        );
      }
    } catch {
      Alert.alert('Error', 'Failed to bulk assign conversations.');
    } finally {
      setAssigning(false);
    }
  };

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <View style={styles.detailContainer}>
      <TouchableOpacity style={styles.backLink} onPress={onBack}>
        <ArrowLeft color={appTheme.text} size={16} />
        <Typography variant="bodySmall" color={appTheme.text} style={{ marginLeft: 6 }}>Back to Integrations</Typography>
      </TouchableOpacity>

      <View style={styles.detailTitleRow}>
        <View style={styles.detailTitleWrapper}>
          <WhatsAppIcon size={32} />
          <View style={{ marginLeft: 12 }}>
            <Typography variant="h3" color={appTheme.text} style={{ fontWeight: '500' }}>WhatsApp Personal</Typography>
            <Typography variant="caption" color={appTheme.muted}>WAPA QR Code Connection</Typography>
          </View>
        </View>
      </View>

      {/* Connection Status Card */}
      <GlassCard style={styles.detailCard}>
        <View style={styles.cardInfoRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Smartphone color={appTheme.text} size={20} />
            <Typography variant="bodySmall" style={{ marginLeft: 8, fontWeight: '600' }}>Connection Status</Typography>
          </View>
          <Badge 
            label={
              status === 'connected' ? 'Connected' :
              status === 'qr_scanning' ? 'Waiting for Scan' :
              status === 'connecting' ? 'Generating QR' :
              status === 'error' ? 'Error' : 'Disconnected'
            } 
            variant={status === 'connected' ? 'success' : status === 'error' ? 'warning' : 'default'}
          />
        </View>

        {status === 'connected' && account && (
          <View style={[styles.successBanner, { backgroundColor: appTheme.softSurface }]}>
            <Wifi color={appTheme.success} size={18} />
            <View style={{ marginLeft: 8 }}>
              <Typography variant="bodySmall" style={{ fontWeight: '600' }}>WhatsApp Link Connected</Typography>
              {account.phone_number && <Typography variant="caption" color={appTheme.muted}>Phone: {account.phone_number}</Typography>}
            </View>
          </View>
        )}

        {error && (
          <View style={[styles.errorBanner, { borderColor: Theme.colors.error }]}>
            <AlertCircle color={Theme.colors.error} size={16} />
            <Typography variant="caption" color={Theme.colors.error} style={{ marginLeft: 8, flex: 1 }}>{error}</Typography>
          </View>
        )}

        {/* QR Code */}
        {qrCode && status === 'qr_scanning' && (
          <View style={styles.qrContainer}>
            <View style={styles.qrHeader}>
              <Typography variant="bodySmall" style={{ fontWeight: '600' }}>Scan with WhatsApp</Typography>
              <Typography variant="bodySmall" style={{ fontFamily: Theme.fonts.mono, color: timer < 60 ? Theme.colors.error : appTheme.text }}>
                {formatTime(timer)}
              </Typography>
            </View>
            <Image 
              source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrCode)}` }} 
              style={styles.qrImage}
            />
            <Typography variant="caption" color={appTheme.muted} style={{ textAlign: 'center', marginTop: 10 }}>
              Open WhatsApp &gt; Settings &gt; Linked Devices &gt; Link a Device
            </Typography>
          </View>
        )}

        {/* Action Button */}
        <View style={{ marginTop: 14 }}>
          {status !== 'connected' ? (
            <TouchableOpacity 
              style={[styles.submitButton, { backgroundColor: appTheme.primaryAccent }]}
              onPress={startLogin}
              disabled={loading || status === 'qr_scanning'}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Typography variant="body" color={appTheme.darkMode ? '#0F172A' : '#fff'} style={{ fontWeight: '600' }}>
                  {status === 'qr_scanning' ? 'Waiting for scan...' : 'Generate QR Code'}
                </Typography>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={[styles.submitButton, { backgroundColor: Theme.colors.error }]}
              onPress={handleLogout}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Typography variant="body" color="#fff" style={{ fontWeight: '600' }}>Disconnect Personal WA</Typography>
              )}
            </TouchableOpacity>
          )}
        </View>
      </GlassCard>

      {/* Auto Assign */}
      {status === 'connected' && (
        <GlassCard style={styles.detailCard}>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Typography variant="bodySmall" style={{ fontWeight: '600' }}>Auto-assign Contacts</Typography>
              <Typography variant="caption" color={appTheme.muted}>
                Saved contacts route to Human Agents. Unsaved route to AI Agents.
              </Typography>
            </View>
            <Switch 
              value={autoAssignEnabled} 
              onValueChange={handleAutoAssignToggle}
              disabled={autoAssignSaving}
            />
          </View>
        </GlassCard>
      )}

      {/* Team Assign */}
      {status === 'connected' && (
        <GlassCard style={styles.detailCard}>
          <Typography variant="bodySmall" style={{ fontWeight: '600', marginBottom: 10 }}>Assign chats to team member</Typography>
          <View style={styles.formCol}>
            <Typography variant="caption" color={appTheme.muted}>Team Member</Typography>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              <TextInput 
                style={[styles.mobileInput, { flex: 1, backgroundColor: appTheme.input, color: appTheme.text, borderColor: appTheme.border }]} 
                value={selectedTeamMemberId} 
                onChangeText={setSelectedTeamMemberId}
                placeholder="ai_agent"
                placeholderTextColor={appTheme.disabled}
              />
              <TouchableOpacity style={[styles.subRefreshButton, { marginLeft: 8, borderColor: appTheme.border }]} onPress={loadTeamMembers}>
                <RefreshCw size={14} color={appTheme.primaryAccent} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 14, marginVertical: 10 }}>
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center' }} onPress={() => setAssignFilter('unassigned')}>
              <View style={[styles.radioCircle, assignFilter === 'unassigned' && { backgroundColor: appTheme.primaryAccent }]} />
              <Typography variant="caption" style={{ marginLeft: 6 }}>Unassigned Only</Typography>
            </TouchableOpacity>
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center' }} onPress={() => setAssignFilter('all')}>
              <View style={[styles.radioCircle, assignFilter === 'all' && { backgroundColor: appTheme.primaryAccent }]} />
              <Typography variant="caption" style={{ marginLeft: 6 }}>All active chats</Typography>
            </TouchableOpacity>
          </View>

          {assignSuccess && (
            <View style={[styles.successBanner, { marginBottom: 10 }]}>
              <CheckCircle2 color={appTheme.success} size={14} />
              <Typography variant="caption" color={appTheme.success} style={{ marginLeft: 6 }}>{assignSuccess}</Typography>
            </View>
          )}

          <TouchableOpacity 
            style={[styles.submitButton, { backgroundColor: selectedTeamMemberId === 'ai_agent' ? appTheme.success : appTheme.primaryAccent }]}
            onPress={handleAssignChats}
            disabled={assigning}
          >
            {assigning ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Typography variant="bodySmall" color="#fff" style={{ fontWeight: '600' }}>
                {selectedTeamMemberId === 'ai_agent' ? 'Release to AI Agent' : 'Assign Chats'}
              </Typography>
            )}
          </TouchableOpacity>
        </GlassCard>
      )}

      {/* Synced Contacts list */}
      {status === 'connected' && (
        <GlassCard style={styles.detailCard}>
          <TouchableOpacity 
            style={styles.accordionHeader}
            onPress={() => { setContactsExpanded(!contactsExpanded); if(!contactsExpanded && contacts.length === 0) loadContacts(); }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Users size={18} color={appTheme.text} />
              <Typography variant="bodySmall" style={{ marginLeft: 8, fontWeight: '600' }}>
                Synced Contacts ({contactsTotal})
              </Typography>
            </View>
            {contactsExpanded ? <ChevronDown size={16} color={appTheme.muted} /> : <ChevronRight size={16} color={appTheme.muted} />}
          </TouchableOpacity>

          {contactsExpanded && (
            <View style={{ marginTop: 10 }}>
              <TextInput 
                style={[styles.mobileInput, { backgroundColor: appTheme.input, color: appTheme.text, borderColor: appTheme.border, marginBottom: 10 }]} 
                value={contactsSearch} 
                onChangeText={(val) => { setContactsSearch(val); loadContacts(1, val); }}
                placeholder="Search name or number..."
                placeholderTextColor={appTheme.disabled}
              />

              {contactsLoading ? (
                <ActivityIndicator size="small" color={appTheme.primaryAccent} style={{ paddingVertical: 14 }} />
              ) : contacts.length === 0 ? (
                <Typography variant="caption" color={appTheme.muted} style={{ textAlign: 'center', paddingVertical: 14 }}>
                  No contacts found.
                </Typography>
              ) : (
                <View style={{ gap: 8 }}>
                  {contacts.slice(0, 10).map((c) => (
                    <View key={c.phone} style={styles.contactItemRow}>
                      <View style={[styles.avatarCircle, { backgroundColor: appTheme.primarySoft }]}>
                        <Typography variant="caption" color={appTheme.primaryAccent}>
                          {(c.name || '?').charAt(0).toUpperCase()}
                        </Typography>
                      </View>
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Typography variant="bodySmall" style={{ fontWeight: '500' }}>{c.name || c.phone}</Typography>
                        {c.name && <Typography variant="caption" color={appTheme.muted}>+{c.phone}</Typography>}
                      </View>
                      <Badge label={c.is_saved ? 'Saved' : 'Unsaved'} variant={c.is_saved ? 'success' : 'default'} />
                    </View>
                  ))}

                  {/* Simple Pagination */}
                  {contactsTotal > 10 && (
                    <View style={styles.paginationRow}>
                      <TouchableOpacity 
                        style={[styles.pageButton, { borderColor: appTheme.border }]}
                        disabled={contactsPage <= 1}
                        onPress={() => loadContacts(contactsPage - 1, contactsSearch)}
                      >
                        <Typography variant="caption" color={contactsPage <= 1 ? appTheme.disabled : appTheme.text}>Prev</Typography>
                      </TouchableOpacity>
                      <Typography variant="caption">Page {contactsPage}</Typography>
                      <TouchableOpacity 
                        style={[styles.pageButton, { borderColor: appTheme.border }]}
                        disabled={contactsPage * 10 >= contactsTotal}
                        onPress={() => loadContacts(contactsPage + 1, contactsSearch)}
                      >
                        <Typography variant="caption" color={contactsPage * 10 >= contactsTotal ? appTheme.disabled : appTheme.text}>Next</Typography>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}
        </GlassCard>
      )}
    </View>
  );
}

// ── 3. EMAIL OAUTH INTEGRATIONS VIEW (Google/Microsoft) ─────────────────────

function EmailOAuthDetailView({ provider, label, onBack }: { provider: 'google' | 'microsoft'; label: string; onBack: () => void }) {
  const appTheme = useAppTheme();
  const [isConnected, setIsConnected] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const checkStatus = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = provider === 'google' ? '/api/social-integration/email/google/status' : '/api/social-integration/email/microsoft/status';
      const res = await apiPost<any>(endpoint, {});
      if (res.data) {
        setIsConnected(Boolean(res.data.connected));
        setEmail(res.data.email || null);
      }
    } catch {
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  }, [provider]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const handleConnect = async () => {
    setActing(true);
    try {
      const endpoint = provider === 'google' ? '/api/social-integration/email/google/start' : '/api/social-integration/email/microsoft/start';
      const res = await apiPost<any>(endpoint, { frontend_id: 'settings' });
      if (res.data && res.data.url) {
        // Open authorization link in browser
        Linking.openURL(res.data.url);
      } else {
        Alert.alert('Error', 'Failed to retrieve connection URL.');
      }
    } catch {
      Alert.alert('Error', `Failed to connect ${label}.`);
    } finally {
      setActing(false);
    }
  };

  const handleDisconnect = async () => {
    Alert.alert(
      'Disconnect account',
      `Are you sure you want to disconnect your ${label} integration?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            setActing(true);
            try {
              const endpoint = provider === 'google' ? '/api/social-integration/email/google/disconnect' : '/api/social-integration/email/microsoft/disconnect';
              const res = await apiPost<any>(endpoint, {});
              if (res.status === 200) {
                Alert.alert('Disconnected', `${label} account has been disconnected.`);
                checkStatus();
              }
            } catch {
              Alert.alert('Error', 'Failed to disconnect account.');
            } finally {
              setActing(false);
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.detailContainer}>
      <TouchableOpacity style={styles.backLink} onPress={onBack}>
        <ArrowLeft color={appTheme.text} size={16} />
        <Typography variant="bodySmall" color={appTheme.text} style={{ marginLeft: 6 }}>Back to Integrations</Typography>
      </TouchableOpacity>

      <View style={styles.detailTitleRow}>
        <View style={styles.detailTitleWrapper}>
          {provider === 'google' ? <GoogleIcon size={32} /> : <MicrosoftIcon size={32} />}
          <View style={{ marginLeft: 12 }}>
            <Typography variant="h3" color={appTheme.text} style={{ fontWeight: '500' }}>{label}</Typography>
            <Typography variant="caption" color={appTheme.muted}>Email &amp; Calendar Synchronization</Typography>
          </View>
        </View>
      </View>

      <GlassCard style={styles.detailCard}>
        <View style={styles.cardInfoRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Calendar color={appTheme.text} size={20} />
            <Typography variant="bodySmall" style={{ marginLeft: 8, fontWeight: '600' }}>Connection Status</Typography>
          </View>
          <Badge label={isConnected ? 'Connected' : 'Disconnected'} variant={isConnected ? 'success' : 'default'} />
        </View>

        {loading ? (
          <ActivityIndicator size="small" color={appTheme.primaryAccent} style={{ marginVertical: 14 }} />
        ) : isConnected && email ? (
          <View style={[styles.successBanner, { backgroundColor: appTheme.softSurface }]}>
            <CheckCircle2 color={appTheme.success} size={16} />
            <Typography variant="bodySmall" style={{ marginLeft: 8, fontWeight: '600' }}>Connected as {email}</Typography>
          </View>
        ) : (
          <Typography variant="caption" color={appTheme.muted} style={{ marginVertical: 10 }}>
            {label} account is currently not linked. Continue with OAuth setup to connect calendar, sheets, and inbox.
          </Typography>
        )}

        <View style={{ marginTop: 14 }}>
          {!isConnected ? (
            <TouchableOpacity 
              style={[styles.submitButton, { backgroundColor: appTheme.primaryAccent }]}
              onPress={handleConnect}
              disabled={acting}
            >
              {acting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Typography variant="body" color={appTheme.darkMode ? '#0F172A' : '#fff'} style={{ fontWeight: '600' }}>Continue with OAuth</Typography>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={[styles.submitButton, { backgroundColor: Theme.colors.error }]}
              onPress={handleDisconnect}
              disabled={acting}
            >
              {acting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Typography variant="body" color="#fff" style={{ fontWeight: '600' }}>Disconnect Account</Typography>
              )}
            </TouchableOpacity>
          )}
        </View>
      </GlassCard>
    </View>
  );
}

// ── 4. CUSTOM EMAIL (SMTP) DETAIL SUBVIEW ───────────────────────────────────

function CustomEmailDetailView({ onBack }: { onBack: () => void }) {
  const appTheme = useAppTheme();
  const [connected, setConnected] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState('');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [secure, setSecure] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fromAddress, setFromAddress] = useState('');
  const [displayName, setDisplayName] = useState('');

  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiPost<any>('/api/social-integration/email/custom/status', {});
      if (res.data) {
        setConnected(Boolean(res.data.connected));
        setConnectedEmail(res.data.email || '');
      }
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const handleTest = async () => {
    if (!smtpHost || !username || !password) {
      Alert.alert('Required Fields', 'Host, Username, and Password are required to test.');
      return;
    }
    setTesting(true);
    setTestResult(null);
    setActionError(null);
    try {
      const res = await apiPost<any>('/api/social-integration/email/custom/test', {
        host: smtpHost,
        port: Number(smtpPort),
        secure,
        username,
        password,
      });
      if (res.data && res.data.success) {
        setTestResult({ ok: true, message: 'SMTP credentials verified successfully.' });
      } else {
        setTestResult({ ok: false, message: res.data?.error || res.data?.message || 'SMTP Connection test failed.' });
      }
    } catch (e: any) {
      setTestResult({ ok: false, message: e.message || 'Error testing connection.' });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!smtpHost || !username || !password) {
      Alert.alert('Required Fields', 'SMTP credentials are required.');
      return;
    }
    setSaving(true);
    setActionError(null);
    setTestResult(null);
    try {
      const res = await apiPost<any>('/api/social-integration/email/custom/connect', {
        host: smtpHost,
        port: Number(smtpPort),
        secure,
        username,
        password,
        from_address: fromAddress || username,
        display_name: displayName,
      });
      if (res.data && res.data.success) {
        Alert.alert('Connected', 'Custom SMTP account connected successfully.');
        checkStatus();
      } else {
        setActionError(res.data?.error || res.data?.message || 'Failed to save account.');
      }
    } catch (e: any) {
      setActionError(e.message || 'Error connecting account.');
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    Alert.alert(
      'Disconnect SMTP',
      'Are you sure you want to disconnect this SMTP account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await apiPost('/api/social-integration/email/custom/disconnect', {});
              checkStatus();
            } catch {
              Alert.alert('Error', 'Failed to disconnect account.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.detailContainer}>
      <TouchableOpacity style={styles.backLink} onPress={onBack}>
        <ArrowLeft color={appTheme.text} size={16} />
        <Typography variant="bodySmall" color={appTheme.text} style={{ marginLeft: 6 }}>Back to Integrations</Typography>
      </TouchableOpacity>

      <View style={styles.detailTitleRow}>
        <View style={styles.detailTitleWrapper}>
          <Server size={32} color="#059669" />
          <View style={{ marginLeft: 12 }}>
            <Typography variant="h3" color={appTheme.text} style={{ fontWeight: '500' }}>Custom Email (SMTP)</Typography>
            <Typography variant="caption" color={appTheme.muted}>Synchronize private/self-hosted webmails</Typography>
          </View>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="small" color={appTheme.primaryAccent} style={{ marginVertical: 24 }} />
      ) : connected ? (
        <GlassCard style={styles.detailCard}>
          <View style={styles.cardInfoRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <CheckCircle2 color={appTheme.success} size={20} />
              <Typography variant="bodySmall" style={{ marginLeft: 8, fontWeight: '600' }}>Connected to SMTP Inbox</Typography>
            </View>
            <Badge label="Connected" variant="success" />
          </View>
          <Typography variant="caption" color={appTheme.muted} style={{ marginVertical: 8 }}>
            Connected as {connectedEmail}
          </Typography>
          <TouchableOpacity 
            style={[styles.submitButton, { backgroundColor: Theme.colors.error, marginTop: 14 }]}
            onPress={handleDisconnect}
          >
            <Typography variant="body" color="#fff" style={{ fontWeight: '600' }}>Disconnect SMTP</Typography>
          </TouchableOpacity>
        </GlassCard>
      ) : (
        <GlassCard style={styles.detailCard}>
          {actionError && (
            <View style={[styles.errorBanner, { borderColor: Theme.colors.error }]}>
              <AlertCircle size={14} color={Theme.colors.error} />
              <Typography variant="caption" color={Theme.colors.error} style={{ marginLeft: 6 }}>{actionError}</Typography>
            </View>
          )}

          {testResult && (
            <View style={[styles.errorBanner, { borderColor: testResult.ok ? appTheme.success : Theme.colors.error, backgroundColor: testResult.ok ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)' }]}>
              <CheckCircle2 size={14} color={testResult.ok ? appTheme.success : Theme.colors.error} />
              <Typography variant="caption" color={testResult.ok ? appTheme.success : Theme.colors.error} style={{ marginLeft: 6 }}>{testResult.message}</Typography>
            </View>
          )}

          <View style={styles.formFields}>
            <View style={styles.formRow}>
              <View style={[styles.formCol, { flex: 2 }]}>
                <Typography variant="caption" color={appTheme.muted}>SMTP Host</Typography>
                <TextInput 
                  style={[styles.mobileInput, { backgroundColor: appTheme.input, color: appTheme.text, borderColor: appTheme.border }]} 
                  value={smtpHost} 
                  onChangeText={setSmtpHost}
                  placeholder="smtp.domain.com"
                  placeholderTextColor={appTheme.disabled}
                />
              </View>
              <View style={styles.formCol}>
                <Typography variant="caption" color={appTheme.muted}>Port</Typography>
                <TextInput 
                  style={[styles.mobileInput, { backgroundColor: appTheme.input, color: appTheme.text, borderColor: appTheme.border }]} 
                  value={smtpPort} 
                  onChangeText={setSmtpPort}
                  keyboardType="numeric"
                  placeholder="587"
                  placeholderTextColor={appTheme.disabled}
                />
              </View>
            </View>

            <View style={styles.toggleRow}>
              <Typography variant="caption" color={appTheme.muted}>Use SSL/TLS (Port 465)</Typography>
              <Switch value={secure} onValueChange={(val) => { setSecure(val); setSmtpPort(val ? '465' : '587'); }} />
            </View>

            <View style={styles.formCol}>
              <Typography variant="caption" color={appTheme.muted}>Username</Typography>
              <TextInput 
                style={[styles.mobileInput, { backgroundColor: appTheme.input, color: appTheme.text, borderColor: appTheme.border }]} 
                value={username} 
                onChangeText={setUsername}
                placeholder="inbox@domain.com"
                placeholderTextColor={appTheme.disabled}
              />
            </View>

            <View style={styles.formCol}>
              <Typography variant="caption" color={appTheme.muted}>Password</Typography>
              <TextInput 
                style={[styles.mobileInput, { backgroundColor: appTheme.input, color: appTheme.text, borderColor: appTheme.border }]} 
                value={password} 
                onChangeText={setPassword}
                secureTextEntry
                placeholder="SMTP password"
                placeholderTextColor={appTheme.disabled}
              />
            </View>

            <View style={styles.formRow}>
              <View style={styles.formCol}>
                <Typography variant="caption" color={appTheme.muted}>From Email (optional)</Typography>
                <TextInput 
                  style={[styles.mobileInput, { backgroundColor: appTheme.input, color: appTheme.text, borderColor: appTheme.border }]} 
                  value={fromAddress} 
                  onChangeText={setFromAddress}
                  placeholder="sender@domain.com"
                  placeholderTextColor={appTheme.disabled}
                />
              </View>
              <View style={styles.formCol}>
                <Typography variant="caption" color={appTheme.muted}>Sender Name (optional)</Typography>
                <TextInput 
                  style={[styles.mobileInput, { backgroundColor: appTheme.input, color: appTheme.text, borderColor: appTheme.border }]} 
                  value={displayName} 
                  onChangeText={setDisplayName}
                  placeholder="Acme Support"
                  placeholderTextColor={appTheme.disabled}
                />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <TouchableOpacity 
                style={[styles.submitButton, { flex: 1, backgroundColor: 'transparent', borderWidth: 1, borderColor: appTheme.border }]}
                onPress={handleTest}
                disabled={testing || saving}
              >
                {testing ? <ActivityIndicator size="small" color={appTheme.text} /> : <Typography variant="bodySmall" color={appTheme.text}>Test SMTP</Typography>}
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.submitButton, { flex: 1, backgroundColor: appTheme.primaryAccent }]}
                onPress={handleSave}
                disabled={testing || saving}
              >
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Typography variant="bodySmall" color={appTheme.darkMode ? '#0F172A' : '#fff'} style={{ fontWeight: '600' }}>Save &amp; Connect</Typography>}
              </TouchableOpacity>
            </View>
          </View>
        </GlassCard>
      )}
    </View>
  );
}

// ── 5. GOHIGHLEVEL DETAIL SUBVIEW ───────────────────────────────────────────

interface GHLContact {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  synced_at: string;
}

function GoHighLevelDetailView({ onBack }: { onBack: () => void }) {
  const appTheme = useAppTheme();
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [contactsCount, setContactsCount] = useState(0);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  // Connection fields
  const [token, setToken] = useState('');
  const [locationId, setLocationId] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  // Contacts
  const [contacts, setContacts] = useState<GHLContact[]>([]);
  const [contactsTotal, setContactsTotal] = useState(0);
  const [contactsExpanded, setContactsExpanded] = useState(false);
  const [contactsLoading, setContactsLoading] = useState(false);

  const checkStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<any>('/api/social-integration/gohighlevel/status');
      if (res.data && res.data.data) {
        const data = res.data.data;
        setConnected(Boolean(data.connected));
        setContactsCount(data.contacts_count || 0);
        setLastSynced(data.last_synced || null);
      }
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const loadContacts = useCallback(async () => {
    setContactsLoading(true);
    try {
      const res = await apiGet<any>('/api/social-integration/gohighlevel/contacts/local?page=1&limit=20');
      if (res.data) {
        setContacts(res.data.data || []);
        setContactsTotal(res.data.total || 0);
      }
    } catch {
      // ignore
    } finally {
      setContactsLoading(false);
    }
  }, []);

  const handleConnect = async () => {
    if (!token.trim() || !locationId.trim()) {
      Alert.alert('Required Fields', 'Token and Location ID are required.');
      return;
    }
    setSaving(true);
    setActionError(null);
    try {
      const res = await apiPost<any>('/api/social-integration/gohighlevel/connect', {
        access_token: token.trim(),
        location_id: locationId.trim(),
      });
      if (res.data && res.data.success) {
        Alert.alert('Connected', 'GoHighLevel connected successfully.');
        setToken('');
        setLocationId('');
        checkStatus();
      } else {
        setActionError(res.data?.error || 'Failed to connect GHL.');
      }
    } catch (e: any) {
      setActionError(e.message || 'Error occurred during connection.');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await apiGet<any>('/api/social-integration/gohighlevel/test');
      if (res.data && res.data.success) {
        setTestResult(`API connection working. Synced ${res.data.data?.contacts_count || 0} contacts.`);
      } else {
        setTestResult(`Test failed: ${res.data?.error || 'Connection error'}`);
      }
    } catch {
      setTestResult('Test failed: Connection error.');
    } finally {
      setTesting(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await apiPost<any>('/api/social-integration/gohighlevel/contacts/sync', {});
      if (res.data && res.data.success) {
        Alert.alert('Sync Successful', `Synced GHL contacts.`);
        checkStatus();
        if (contactsExpanded) loadContacts();
      }
    } catch {
      Alert.alert('Error', 'Failed to sync contacts.');
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    Alert.alert(
      'Disconnect GoHighLevel',
      'Are you sure you want to disconnect GHL CRM?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiPost('/api/social-integration/gohighlevel/disconnect', {});
              checkStatus();
              setContacts([]);
              setContactsTotal(0);
              setContactsExpanded(false);
            } catch {
              Alert.alert('Error', 'Failed to disconnect.');
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.detailContainer}>
      <TouchableOpacity style={styles.backLink} onPress={onBack}>
        <ArrowLeft color={appTheme.text} size={16} />
        <Typography variant="bodySmall" color={appTheme.text} style={{ marginLeft: 6 }}>Back to Integrations</Typography>
      </TouchableOpacity>

      <View style={styles.detailTitleRow}>
        <View style={styles.detailTitleWrapper}>
          <GoHighLevelIcon size={32} />
          <View style={{ marginLeft: 12 }}>
            <Typography variant="h3" color={appTheme.text} style={{ fontWeight: '500' }}>GoHighLevel CRM</Typography>
            <Typography variant="caption" color={appTheme.muted}>Sync leads and contacts pipeline</Typography>
          </View>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="small" color={appTheme.primaryAccent} style={{ marginVertical: 24 }} />
      ) : connected ? (
        <View style={{ gap: Theme.spacing.lg }}>
          <GlassCard style={styles.detailCard}>
            <View style={[styles.successBanner, { backgroundColor: appTheme.softSurface }]}>
              <CheckCircle2 color={appTheme.success} size={16} />
              <Typography variant="bodySmall" style={{ marginLeft: 8, fontWeight: '600' }}>GoHighLevel Connected</Typography>
            </View>
            
            <View style={{ marginVertical: 10, gap: 4 }}>
              <Typography variant="caption" color={appTheme.muted}>Location ID: {locationId || 'Connected'}</Typography>
              <Typography variant="caption" color={appTheme.muted}>Synced Contacts: {contactsCount}</Typography>
              {lastSynced && <Typography variant="caption" color={appTheme.muted}>Last Synced: {new Date(lastSynced).toLocaleString()}</Typography>}
            </View>

            {testResult && (
              <View style={[styles.errorBanner, { borderColor: appTheme.border, marginBottom: 10 }]}>
                <Typography variant="caption">{testResult}</Typography>
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity 
                style={[styles.submitButton, { flex: 1, backgroundColor: appTheme.primaryAccent }]}
                onPress={handleSync}
                disabled={syncing}
              >
                {syncing ? <ActivityIndicator size="small" color="#fff" /> : <Typography variant="bodySmall" color={appTheme.darkMode ? '#0F172A' : '#fff'} style={{ fontWeight: '600' }}>Sync Contacts</Typography>}
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.submitButton, { flex: 1, backgroundColor: 'transparent', borderWidth: 1, borderColor: appTheme.border }]}
                onPress={handleTest}
                disabled={testing}
              >
                {testing ? <ActivityIndicator size="small" color={appTheme.text} /> : <Typography variant="bodySmall" color={appTheme.text}>Test API</Typography>}
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.submitButton, { backgroundColor: Theme.colors.error }]}
                onPress={handleDisconnect}
              >
                <Trash2 size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          </GlassCard>

          {/* Collapsible Synced Contacts */}
          <GlassCard style={styles.detailCard}>
            <TouchableOpacity 
              style={styles.accordionHeader}
              onPress={() => { setContactsExpanded(!contactsExpanded); if(!contactsExpanded && contacts.length === 0) loadContacts(); }}
            >
              <Typography variant="bodySmall" style={{ fontWeight: '600' }}>Synced GHL Contacts ({contactsTotal})</Typography>
              {contactsExpanded ? <ChevronDown size={16} color={appTheme.muted} /> : <ChevronRight size={16} color={appTheme.muted} />}
            </TouchableOpacity>

            {contactsExpanded && (
              <View style={{ marginTop: 10 }}>
                {contactsLoading ? (
                  <ActivityIndicator size="small" color={appTheme.primaryAccent} />
                ) : contacts.length === 0 ? (
                  <Typography variant="caption" color={appTheme.muted}>No contacts synced yet.</Typography>
                ) : (
                  <View style={{ gap: 8 }}>
                    {contacts.slice(0, 5).map(c => (
                      <View key={c.id} style={styles.contactItemRow}>
                        <View style={{ flex: 1 }}>
                          <Typography variant="bodySmall" style={{ fontWeight: '500' }}>{c.name || 'Unknown'}</Typography>
                          <Typography variant="caption" color={appTheme.muted}>{c.email || c.phone || 'No details'}</Typography>
                        </View>
                        {c.company_name && <Badge label={c.company_name} variant="default" />}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </GlassCard>
        </View>
      ) : (
        <GlassCard style={styles.detailCard}>
          {actionError && (
            <View style={[styles.errorBanner, { borderColor: Theme.colors.error }]}>
              <AlertCircle size={14} color={Theme.colors.error} />
              <Typography variant="caption" color={Theme.colors.error} style={{ marginLeft: 6 }}>{actionError}</Typography>
            </View>
          )}

          <View style={styles.formFields}>
            <View style={styles.formCol}>
              <Typography variant="caption" color={appTheme.muted}>Private Integration Token</Typography>
              <View style={{ position: 'relative', marginTop: 4 }}>
                <TextInput 
                  style={[styles.mobileInput, { backgroundColor: appTheme.input, color: appTheme.text, borderColor: appTheme.border }]} 
                  value={token} 
                  onChangeText={setToken}
                  secureTextEntry={!showToken}
                  placeholder="GHL Private Token"
                  placeholderTextColor={appTheme.disabled}
                />
                <TouchableOpacity 
                  style={{ position: 'absolute', right: 10, top: 12 }}
                  onPress={() => setShowToken(!showToken)}
                >
                  {showToken ? <EyeOff size={16} color={appTheme.muted} /> : <Eye size={16} color={appTheme.muted} />}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.formCol}>
              <Typography variant="caption" color={appTheme.muted}>Location ID</Typography>
              <TextInput 
                style={[styles.mobileInput, { backgroundColor: appTheme.input, color: appTheme.text, borderColor: appTheme.border }]} 
                value={locationId} 
                onChangeText={setLocationId}
                placeholder="GHL Location ID"
                placeholderTextColor={appTheme.disabled}
              />
            </View>

            <TouchableOpacity 
              style={[styles.submitButton, { backgroundColor: appTheme.primaryAccent }]}
              onPress={handleConnect}
              disabled={saving}
            >
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Typography variant="body" color={appTheme.darkMode ? '#0F172A' : '#fff'} style={{ fontWeight: '600' }}>Connect GoHighLevel</Typography>}
            </TouchableOpacity>
          </View>
        </GlassCard>
      )}
    </View>
  );
}

// ── 6. MINDBODY DETAIL SUBVIEW ──────────────────────────────────────────────

function MindBodyDetailView({ onBack }: { onBack: () => void }) {
  const appTheme = useAppTheme();
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [siteId, setSiteId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [targetClasses, setTargetClasses] = useState<string[]>([]);

  // Setup form states
  const [formSiteId, setFormSiteId] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formApiKey, setFormApiKey] = useState('');
  const [formPassword, setFormPassword] = useState('');

  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiPost<any>('/api/social-integration/mindbody/status', {});
      if (res.data && res.data.connected) {
        setConnected(true);
        setSiteId(res.data.site_id || '');
        setDisplayName(res.data.display_name || '');
        setTargetClasses(res.data.target_classes || []);
      } else {
        setConnected(false);
      }
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const handleConnect = async () => {
    if (!formSiteId || !formApiKey) {
      Alert.alert('Required Fields', 'Site ID and API Key are required.');
      return;
    }
    setSaving(true);
    setActionError(null);
    try {
      const res = await apiPost<any>('/api/social-integration/mindbody/connect', {
        site_id: formSiteId,
        display_name: formDisplayName,
        username: formUsername,
        api_key: formApiKey,
        password: formPassword,
      });
      if (res.data && res.data.success) {
        Alert.alert('Connected', 'MindBody connected successfully.');
        checkStatus();
      } else {
        setActionError(res.data?.error || 'Failed to connect MindBody.');
      }
    } catch (e: any) {
      setActionError(e.message || 'Error connecting MindBody.');
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    Alert.alert(
      'Disconnect MindBody',
      'Are you sure you want to disconnect site?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiPost('/api/social-integration/mindbody/disconnect', {});
              checkStatus();
            } catch {
              Alert.alert('Error', 'Failed to disconnect site.');
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.detailContainer}>
      <TouchableOpacity style={styles.backLink} onPress={onBack}>
        <ArrowLeft color={appTheme.text} size={16} />
        <Typography variant="bodySmall" color={appTheme.text} style={{ marginLeft: 6 }}>Back to Integrations</Typography>
      </TouchableOpacity>

      <View style={styles.detailTitleRow}>
        <View style={styles.detailTitleWrapper}>
          <Typography variant="h3" style={{ fontSize: 32 }}>🧘</Typography>
          <View style={{ marginLeft: 12 }}>
            <Typography variant="h3" color={appTheme.text} style={{ fontWeight: '500' }}>MindBody</Typography>
            <Typography variant="caption" color={appTheme.muted}>Automate class booking workflows</Typography>
          </View>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="small" color={appTheme.primaryAccent} style={{ marginVertical: 24 }} />
      ) : connected ? (
        <GlassCard style={styles.detailCard}>
          <View style={styles.cardInfoRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <CheckCircle2 color={appTheme.success} size={20} />
              <Typography variant="bodySmall" style={{ marginLeft: 8, fontWeight: '600' }}>MindBody Connected</Typography>
            </View>
            <Badge label="Connected" variant="success" />
          </View>
          
          <View style={{ marginVertical: 10, gap: 4 }}>
            <Typography variant="caption" color={appTheme.muted}>Site ID: {siteId}</Typography>
            <Typography variant="caption" color={appTheme.muted}>Display Name: {displayName}</Typography>
            <Typography variant="caption" color={appTheme.muted}>Target Classes: {targetClasses.join(', ') || 'None'}</Typography>
          </View>

          <TouchableOpacity 
            style={[styles.submitButton, { backgroundColor: Theme.colors.error, marginTop: 14 }]}
            onPress={handleDisconnect}
          >
            <Typography variant="body" color="#fff" style={{ fontWeight: '600' }}>Disconnect MindBody</Typography>
          </TouchableOpacity>
        </GlassCard>
      ) : (
        <GlassCard style={styles.detailCard}>
          {actionError && (
            <View style={[styles.errorBanner, { borderColor: Theme.colors.error }]}>
              <AlertCircle size={14} color={Theme.colors.error} />
              <Typography variant="caption" color={Theme.colors.error} style={{ marginLeft: 6 }}>{actionError}</Typography>
            </View>
          )}

          <View style={styles.formFields}>
            <View style={styles.formCol}>
              <Typography variant="caption" color={appTheme.muted}>Site ID *</Typography>
              <TextInput 
                style={[styles.mobileInput, { backgroundColor: appTheme.input, color: appTheme.text, borderColor: appTheme.border }]} 
                value={formSiteId} 
                onChangeText={setFormSiteId}
                placeholder="MindBody Site ID"
                placeholderTextColor={appTheme.disabled}
              />
            </View>

            <View style={styles.formCol}>
              <Typography variant="caption" color={appTheme.muted}>API Key *</Typography>
              <TextInput 
                style={[styles.mobileInput, { backgroundColor: appTheme.input, color: appTheme.text, borderColor: appTheme.border }]} 
                value={formApiKey} 
                onChangeText={setFormApiKey}
                secureTextEntry
                placeholder="Developer API Key"
                placeholderTextColor={appTheme.disabled}
              />
            </View>

            <View style={styles.formCol}>
              <Typography variant="caption" color={appTheme.muted}>Display Name</Typography>
              <TextInput 
                style={[styles.mobileInput, { backgroundColor: appTheme.input, color: appTheme.text, borderColor: appTheme.border }]} 
                value={formDisplayName} 
                onChangeText={setFormDisplayName}
                placeholder="Acme Studio"
                placeholderTextColor={appTheme.disabled}
              />
            </View>

            <View style={styles.formRow}>
              <View style={styles.formCol}>
                <Typography variant="caption" color={appTheme.muted}>Username (staff)</Typography>
                <TextInput 
                  style={[styles.mobileInput, { backgroundColor: appTheme.input, color: appTheme.text, borderColor: appTheme.border }]} 
                  value={formUsername} 
                  onChangeText={setFormUsername}
                  placeholder="Staff username"
                  placeholderTextColor={appTheme.disabled}
                />
              </View>
              <View style={styles.formCol}>
                <Typography variant="caption" color={appTheme.muted}>Password</Typography>
                <TextInput 
                  style={[styles.mobileInput, { backgroundColor: appTheme.input, color: appTheme.text, borderColor: appTheme.border }]} 
                  value={formPassword} 
                  onChangeText={setFormPassword}
                  secureTextEntry
                  placeholder="Staff password"
                  placeholderTextColor={appTheme.disabled}
                />
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.submitButton, { backgroundColor: appTheme.primaryAccent }]}
              onPress={handleConnect}
              disabled={saving}
            >
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Typography variant="body" color={appTheme.darkMode ? '#0F172A' : '#fff'} style={{ fontWeight: '600' }}>Connect MindBody</Typography>}
            </TouchableOpacity>
          </View>
        </GlassCard>
      )}
    </View>
  );
}

// ── 7. ROUTE MAGIC DETAIL SUBVIEW ───────────────────────────────────────────

function RouteMagicDetailView({ onBack }: { onBack: () => void }) {
  const appTheme = useAppTheme();
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [rmTenantId, setRmTenantId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');

  // Setup form states
  const [formTenantId, setFormTenantId] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formApiKey, setFormApiKey] = useState('');
  const [formBaseUrl, setFormBaseUrl] = useState('https://staging-api.routemagic.co.uk');

  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<any>('/api/social-integration/routemagic/status');
      if (res.data && res.data.connected) {
        setConnected(true);
        setRmTenantId(res.data.rm_tenant_id || '');
        setDisplayName(res.data.display_name || '');
        setBaseUrl(res.data.base_url || '');
      } else {
        setConnected(false);
      }
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const handleConnect = async () => {
    if (!formTenantId || !formApiKey) {
      Alert.alert('Required Fields', 'Tenant ID and API Key are required.');
      return;
    }
    setSaving(true);
    setActionError(null);
    try {
      const res = await apiPost<any>('/api/social-integration/routemagic/connect', {
        rm_tenant_id: formTenantId,
        display_name: formDisplayName,
        api_key: formApiKey,
        base_url: formBaseUrl,
      });
      if (res.data && res.data.success) {
        Alert.alert('Connected', 'Route Magic ERP connected successfully.');
        checkStatus();
      } else {
        setActionError(res.data?.error || 'Failed to connect Route Magic.');
      }
    } catch (e: any) {
      setActionError(e.message || 'Error connecting Route Magic.');
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await apiPost<any>('/api/social-integration/routemagic/customers/sync', {});
      if (res.data && res.data.success) {
        Alert.alert('Sync Complete', 'Customers successfully synchronized as CRM leads.');
      }
    } catch {
      Alert.alert('Error', 'Failed to synchronize Route Magic customers.');
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    Alert.alert(
      'Disconnect Route Magic',
      'Are you sure you want to disconnect ERP?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiPost('/api/social-integration/routemagic/disconnect', {});
              checkStatus();
            } catch {
              Alert.alert('Error', 'Failed to disconnect.');
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.detailContainer}>
      <TouchableOpacity style={styles.backLink} onPress={onBack}>
        <ArrowLeft color={appTheme.text} size={16} />
        <Typography variant="bodySmall" color={appTheme.text} style={{ marginLeft: 6 }}>Back to Integrations</Typography>
      </TouchableOpacity>

      <View style={styles.detailTitleRow}>
        <View style={styles.detailTitleWrapper}>
          <Truck size={32} color="#047857" />
          <View style={{ marginLeft: 12 }}>
            <Typography variant="h3" color={appTheme.text} style={{ fontWeight: '500' }}>Route Magic</Typography>
            <Typography variant="caption" color={appTheme.muted}>Synchronize customer ERP profiles</Typography>
          </View>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="small" color={appTheme.primaryAccent} style={{ marginVertical: 24 }} />
      ) : connected ? (
        <GlassCard style={styles.detailCard}>
          <View style={styles.cardInfoRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <CheckCircle2 color={appTheme.success} size={20} />
              <Typography variant="bodySmall" style={{ marginLeft: 8, fontWeight: '600' }}>Route Magic Active</Typography>
            </View>
            <Badge label="Connected" variant="success" />
          </View>

          <View style={{ marginVertical: 10, gap: 4 }}>
            <Typography variant="caption" color={appTheme.muted}>Tenant: {rmTenantId}</Typography>
            <Typography variant="caption" color={appTheme.muted}>Name: {displayName}</Typography>
            <Typography variant="caption" color={appTheme.muted}>Base URL: {baseUrl}</Typography>
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <TouchableOpacity 
              style={[styles.submitButton, { flex: 1, backgroundColor: appTheme.primaryAccent }]}
              onPress={handleSync}
              disabled={syncing}
            >
              {syncing ? <ActivityIndicator size="small" color="#fff" /> : <Typography variant="bodySmall" color={appTheme.darkMode ? '#0F172A' : '#fff'} style={{ fontWeight: '600' }}>Sync Customers</Typography>}
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.submitButton, { backgroundColor: Theme.colors.error }]}
              onPress={handleDisconnect}
            >
              <Trash2 size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </GlassCard>
      ) : (
        <GlassCard style={styles.detailCard}>
          {actionError && (
            <View style={[styles.errorBanner, { borderColor: Theme.colors.error }]}>
              <AlertCircle size={14} color={Theme.colors.error} />
              <Typography variant="caption" color={Theme.colors.error} style={{ marginLeft: 6 }}>{actionError}</Typography>
            </View>
          )}

          <View style={styles.formFields}>
            <View style={styles.formCol}>
              <Typography variant="caption" color={appTheme.muted}>Tenant ID *</Typography>
              <TextInput 
                style={[styles.mobileInput, { backgroundColor: appTheme.input, color: appTheme.text, borderColor: appTheme.border }]} 
                value={formTenantId} 
                onChangeText={setFormTenantId}
                placeholder="Route Magic Tenant ID"
                placeholderTextColor={appTheme.disabled}
              />
            </View>

            <View style={styles.formCol}>
              <Typography variant="caption" color={appTheme.muted}>API Key *</Typography>
              <TextInput 
                style={[styles.mobileInput, { backgroundColor: appTheme.input, color: appTheme.text, borderColor: appTheme.border }]} 
                value={formApiKey} 
                onChangeText={setFormApiKey}
                secureTextEntry
                placeholder="Route Magic API Key"
                placeholderTextColor={appTheme.disabled}
              />
            </View>

            <View style={styles.formCol}>
              <Typography variant="caption" color={appTheme.muted}>Display Name</Typography>
              <TextInput 
                style={[styles.mobileInput, { backgroundColor: appTheme.input, color: appTheme.text, borderColor: appTheme.border }]} 
                value={formDisplayName} 
                onChangeText={setFormDisplayName}
                placeholder="Acme ERP"
                placeholderTextColor={appTheme.disabled}
              />
            </View>

            <View style={styles.formCol}>
              <Typography variant="caption" color={appTheme.muted}>Base URL</Typography>
              <TextInput 
                style={[styles.mobileInput, { backgroundColor: appTheme.input, color: appTheme.text, borderColor: appTheme.border }]} 
                value={formBaseUrl} 
                onChangeText={setFormBaseUrl}
                placeholder="https://staging-api.routemagic.co.uk"
                placeholderTextColor={appTheme.disabled}
              />
            </View>

            <TouchableOpacity 
              style={[styles.submitButton, { backgroundColor: appTheme.primaryAccent }]}
              onPress={handleConnect}
              disabled={saving}
            >
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Typography variant="body" color={appTheme.darkMode ? '#0F172A' : '#fff'} style={{ fontWeight: '600' }}>Connect Route Magic</Typography>}
            </TouchableOpacity>
          </View>
        </GlassCard>
      )}
    </View>
  );
}

// ── 8. LINKEDIN DETAIL SUBVIEW ──────────────────────────────────────────────

interface LinkedInAccountDetail {
  id?: string;
  connected: boolean;
  status?: string;
  profileName?: string;
  accountName?: string;
  email?: string;
}

function LinkedInDetailView({ onBack }: { onBack: () => void }) {
  const appTheme = useAppTheme();
  const [connections, setConnections] = useState<LinkedInAccountDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState<Record<string, boolean>>({});

  // Credentials form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<any>('/api/campaigns/linkedin/accounts');
      if (res.data) {
        if (Array.isArray(res.data.accounts)) setConnections(res.data.accounts);
        else if (Array.isArray(res.data.connections)) setConnections(res.data.connections);
        else if (Array.isArray(res.data)) setConnections(res.data);
      }
    } catch {
      setConnections([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const handleConnect = async () => {
    if (!email || !password) {
      Alert.alert('Required Fields', 'Email and Password are required.');
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const res = await apiPost<any>('/api/campaigns/linkedin/connect', {
        method: 'credentials',
        email: email.trim(),
        password: password.trim()
      });
      if (res.data && res.data.success) {
        Alert.alert('Connected', 'LinkedIn account connection initiated successfully.');
        setEmail('');
        setPassword('');
        checkStatus();
      } else {
        setError(res.data?.error || 'Failed to connect LinkedIn account.');
      }
    } catch (e: any) {
      setError(e.message || 'Error occurred during connection.');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async (accountId: string, label: string) => {
    Alert.alert(
      'Disconnect Account',
      `Are you sure you want to disconnect "${label}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            setDisconnecting(prev => ({ ...prev, [accountId]: true }));
            try {
              const res = await apiPost<any>('/api/campaigns/linkedin/disconnect', { accountId });
              if (res.status === 200) {
                Alert.alert('Disconnected', 'Account disconnected.');
                checkStatus();
              }
            } catch {
              Alert.alert('Error', 'Failed to disconnect account.');
            } finally {
              setDisconnecting(prev => ({ ...prev, [accountId]: false }));
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.detailContainer}>
      <TouchableOpacity style={styles.backLink} onPress={onBack}>
        <ArrowLeft color={appTheme.text} size={16} />
        <Typography variant="bodySmall" color={appTheme.text} style={{ marginLeft: 6 }}>Back to Integrations</Typography>
      </TouchableOpacity>

      <View style={styles.detailTitleRow}>
        <View style={styles.detailTitleWrapper}>
          <LinkedInIcon size={32} />
          <View style={{ marginLeft: 12 }}>
            <Typography variant="h3" color={appTheme.text} style={{ fontWeight: '500' }}>LinkedIn</Typography>
            <Typography variant="caption" color={appTheme.muted}>Sync leads and manage outreach outreach</Typography>
          </View>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="small" color={appTheme.primaryAccent} style={{ marginVertical: 24 }} />
      ) : (
        <View style={{ gap: Theme.spacing.lg }}>
          <GlassCard style={styles.detailCard}>
            <Typography variant="bodySmall" style={{ fontWeight: '600', marginBottom: 10 }}>Connected LinkedIn Accounts</Typography>
            {connections.length === 0 ? (
              <Typography variant="caption" color={appTheme.muted}>No LinkedIn accounts connected.</Typography>
            ) : (
              <View style={{ gap: 10 }}>
                {connections.map(conn => {
                  const accountId = conn.id || '';
                  const displayName = conn.accountName || conn.profileName || conn.email || 'LinkedIn Profile';
                  return (
                    <View key={accountId} style={styles.contactItemRow}>
                      <View style={{ flex: 1 }}>
                        <Typography variant="bodySmall" style={{ fontWeight: '500' }}>{displayName}</Typography>
                        <Typography variant="caption" color={appTheme.muted}>{conn.status || 'Connected'}</Typography>
                      </View>
                      <TouchableOpacity 
                        style={[styles.smallAddButton, { backgroundColor: 'transparent', borderWidth: 1, borderColor: appTheme.border }]}
                        onPress={() => handleDisconnect(accountId, displayName)}
                        disabled={disconnecting[accountId]}
                      >
                        {disconnecting[accountId] ? <ActivityIndicator size="small" color={appTheme.text} /> : <Typography variant="caption" color={Theme.colors.error}>Disconnect</Typography>}
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}
          </GlassCard>

          {/* Form */}
          <GlassCard style={styles.detailCard}>
            <Typography variant="bodySmall" style={{ fontWeight: '600', marginBottom: 10 }}>Connect LinkedIn Account</Typography>
            {error && (
              <View style={[styles.errorBanner, { borderColor: Theme.colors.error, marginBottom: 10 }]}>
                <Typography variant="caption" color={Theme.colors.error}>{error}</Typography>
              </View>
            )}

            <View style={styles.formFields}>
              <View style={styles.formCol}>
                <Typography variant="caption" color={appTheme.muted}>LinkedIn Email / Username</Typography>
                <TextInput 
                  style={[styles.mobileInput, { backgroundColor: appTheme.input, color: appTheme.text, borderColor: appTheme.border }]} 
                  value={email} 
                  onChangeText={setEmail}
                  placeholder="email@example.com"
                  placeholderTextColor={appTheme.disabled}
                />
              </View>

              <View style={styles.formCol}>
                <Typography variant="caption" color={appTheme.muted}>Password</Typography>
                <TextInput 
                  style={[styles.mobileInput, { backgroundColor: appTheme.input, color: appTheme.text, borderColor: appTheme.border }]} 
                  value={password} 
                  onChangeText={setPassword}
                  secureTextEntry
                  placeholder="LinkedIn Password"
                  placeholderTextColor={appTheme.disabled}
                />
              </View>

              <TouchableOpacity 
                style={[styles.submitButton, { backgroundColor: appTheme.primaryAccent }]}
                onPress={handleConnect}
                disabled={connecting}
              >
                {connecting ? <ActivityIndicator size="small" color="#fff" /> : <Typography variant="body" color={appTheme.darkMode ? '#0F172A' : '#fff'} style={{ fontWeight: '600' }}>Connect Account</Typography>}
              </TouchableOpacity>
            </View>
          </GlassCard>
        </View>
      )}
    </View>
  );
}

// ── STYLES ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { 
    flex: 1 
  },
  scrollContent: { 
    paddingHorizontal: Theme.spacing.xl 
  },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: Theme.spacing.xl 
  },
  headerText: { 
    flex: 1 
  },
  refreshButton: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    borderWidth: 1, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  messageCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: Theme.spacing.md, 
    marginBottom: Theme.spacing.lg, 
    borderWidth: 1 
  },
  grid: { 
    gap: Theme.spacing.lg 
  },
  card: { 
    padding: Theme.spacing.lg,
    borderRadius: Theme.radius.lg
  },
  cardHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start', 
    marginBottom: Theme.spacing.md 
  },
  cardHeaderLeft: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    flex: 1 
  },
  cardHeaderRight: { 
    marginLeft: 8 
  },
  titleContainer: { 
    marginLeft: 12, 
    flex: 1 
  },
  categoryText: { 
    textTransform: 'uppercase', 
    letterSpacing: 0.8, 
    fontSize: 10, 
    fontWeight: '600' 
  },
  cardTitle: { 
    marginTop: 2 
  },
  iconWrapper: { 
    width: 48, 
    height: 48, 
    borderRadius: 12, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  iconSkeleton: { 
    width: 48, 
    height: 48 
  },
  cardBody: { 
    marginBottom: Theme.spacing.lg 
  },
  descriptionText: { 
    lineHeight: 18 
  },
  accountBadgeContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginTop: 10, 
    paddingVertical: 6, 
    paddingHorizontal: 10, 
    borderRadius: 8, 
    borderWidth: 1, 
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  accountText: { 
    fontWeight: '500' 
  },
  cardFooter: { 
    marginTop: 4 
  },
  actionButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 10, 
    borderRadius: Theme.radius.md,
    height: 40,
  },
  primaryButton: {},
  secondaryButton: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: { 
    fontSize: 13 
  },

  // Detail Subviews Styles
  detailContainer: {
    flex: 1,
    gap: 16
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  detailTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  detailTitleWrapper: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  subRefreshButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  detailCard: {
    padding: Theme.spacing.lg,
    borderRadius: Theme.radius.lg
  },
  cardTitleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.md
  },
  smallAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: Theme.radius.sm
  },
  emptyAccounts: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28
  },
  accountsList: {
    gap: Theme.spacing.sm
  },
  accountItem: {
    borderBottomWidth: 1,
    paddingVertical: 10
  },
  accountItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  accountItemHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  accountItemHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  accountExpanded: {
    marginTop: 8,
    borderRadius: 8,
    padding: 10
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  detailGridItem: {
    width: '45%'
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
    marginBottom: 12
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    marginTop: Theme.spacing.md
  },
  formFields: {
    gap: 12
  },
  formRow: {
    flexDirection: 'row',
    gap: Theme.spacing.md
  },
  formCol: {
    flex: 1,
    gap: 4
  },
  mobileInput: {
    borderWidth: 1,
    borderRadius: Theme.radius.md,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 13,
    height: 40
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4
  },
  submitButton: {
    height: 40,
    borderRadius: Theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8
  },
  cardInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  qrContainer: {
    alignItems: 'center',
    marginTop: Theme.spacing.lg,
    padding: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#ccc',
    borderRadius: 12
  },
  qrHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 10
  },
  qrImage: {
    width: 200,
    height: 200,
    borderRadius: 8
  },
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  contactItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)'
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10
  },
  pageButton: {
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6
  },
  radioCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#ccc'
  },
  comingSoonContainer: {
    flex: 1,
    gap: 16
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  backButtonText: {
    marginLeft: 6
  }
});
