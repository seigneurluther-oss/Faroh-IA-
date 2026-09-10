import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSendAiChat } from '@workspace/api-client-react';
import colors from '@/constants/colors';

type Language = 'ht' | 'fr';
type Role = 'assistant' | 'user';

type Message = {
  id: string;
  role: Role;
  text: string;
  createdAt: string;
  imageUri?: string;
};

type Conversation = {
  id: string;
  title: string;
  updatedAt: string;
  messages: Message[];
};

const STORAGE_KEY = '@faroh-ia/conversations';
const primary = colors.light.primary;
const ink = colors.light.foreground;
const softInk = colors.light.mutedForeground;
const cream = colors.light.background;
const green = '#167C68';
const navy = '#17212B';

const copy = {
  ht: {
    greeting: 'Bonjou',
    intro: 'Mwen se Faroh IA. Kisa ou vle mwen ede w aprann jodi a?',
    placeholder: 'Ekri yon kesyon...',
    newChat: 'Nouvo chat',
    history: 'Istwa',
    close: 'Fèmen',
    send: 'Voye',
    attach: 'Ajoute yon foto',
    subjects: 'Mwen ka ede w nan...',
    emptyHistory: 'Ou poko gen okenn lòt konvèsasyon.',
    delete: 'Efase',
    deleteConfirm: 'Èske ou vle efase konvèsasyon sa a?',
    cancel: 'Anile',
    analyzing: 'M ap analize egzèsis la...',
    imageAdded: 'Foto egzèsis la pare. Ekri sa ou ta renmen konprann sou li.',
    choosePhoto: 'Chwazi yon foto',
    camera: 'Kamera',
    gallery: 'Galri',
    cameraUnavailable: 'Kamera a pa disponib nan vèsyon preview sa a. Ou ka chwazi yon foto nan galri a.',
    sampleReply:
      'Mwen la pou ede w konprann, pa sèlman jwenn repons lan. Voye egzèsis la oswa ekri kesyon an, epi m ap esplike chak etap klèman.',
    languageHint: 'Lang lan chanje pou pwochen repons yo.',
  },
  fr: {
    greeting: 'Bonjour',
    intro: 'Je suis Faroh IA. Qu’aimeriez-vous apprendre aujourd’hui ?',
    placeholder: 'Écrivez une question...',
    newChat: 'Nouveau chat',
    history: 'Historique',
    close: 'Fermer',
    send: 'Envoyer',
    attach: 'Ajouter une photo',
    subjects: 'Je peux vous aider en...',
    emptyHistory: 'Vous n’avez pas encore d’autre conversation.',
    delete: 'Supprimer',
    deleteConfirm: 'Voulez-vous supprimer cette conversation ?',
    cancel: 'Annuler',
    analyzing: 'J’analyse votre exercice...',
    imageAdded: 'La photo est prête. Écrivez ce que vous souhaitez comprendre.',
    choosePhoto: 'Choisir une photo',
    camera: 'Caméra',
    gallery: 'Galerie',
    cameraUnavailable: 'La caméra n’est pas disponible dans cet aperçu. Vous pouvez choisir une photo dans la galerie.',
    sampleReply:
      'Je suis là pour vous aider à comprendre, pas seulement à trouver la réponse. Envoyez l’exercice ou écrivez votre question : j’expliquerai chaque étape clairement.',
    languageHint: 'La langue s’appliquera aux prochaines réponses.',
  },
} as const;

const subjects = [
  { label: 'Matematik', icon: 'hash' as const },
  { label: 'Fizik', icon: 'activity' as const },
  { label: 'Chimi', icon: 'droplet' as const },
  { label: 'Biyoloji', icon: 'circle' as const },
  { label: 'Ekonomi', icon: 'trending-up' as const },
  { label: 'Filozofi', icon: 'book-open' as const },
];

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function makeWelcome(language: Language): Message {
  const t = copy[language];
  return {
    id: makeId(),
    role: 'assistant',
    text: `${t.greeting} 👋🏽\n${t.intro}`,
    createdAt: new Date().toISOString(),
  };
}

function makeConversation(language: Language): Conversation {
  return {
    id: makeId(),
    title: language === 'ht' ? 'Nouvo konvèsasyon' : 'Nouvelle conversation',
    updatedAt: new Date().toISOString(),
    messages: [makeWelcome(language)],
  };
}

function formatConversationDate(dateString: string, language: Language) {
  const date = new Date(dateString);
  return date.toLocaleDateString(language === 'ht' ? 'fr-FR' : 'fr-FR', {
    day: 'numeric',
    month: 'short',
  });
}

function getApiMessage(error: unknown, fallback: string) {
  if (!error || typeof error !== 'object') return fallback;
  const data = (error as { data?: unknown }).data;
  if (!data || typeof data !== 'object') return fallback;
  const message = (data as { message?: unknown }).message;
  return typeof message === 'string' && message.trim() ? message : fallback;
}

export default function FarohHome() {
  const insets = useSafeAreaInsets();
  const [language, setLanguage] = useState<Language>('ht');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState('');
  const [draft, setDraft] = useState('');
  const [pendingImage, setPendingImage] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showPhotoActions, setShowPhotoActions] = useState(false);
  const aiChat = useSendAiChat();

  const t = copy[language];
  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeId) ?? conversations[0],
    [activeId, conversations],
  );
  const messages = activeConversation?.messages ?? [];
  const reversedMessages = useMemo(() => [...messages].reverse(), [messages]);

  useEffect(() => {
    const loadConversations = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as Conversation[];
          if (parsed.length > 0) {
            setConversations(parsed);
            setActiveId(parsed[0].id);
            setIsLoading(false);
            return;
          }
        }
      } catch {
        // Start clean if old local data cannot be decoded.
      }
      const first = makeConversation('ht');
      setConversations([first]);
      setActiveId(first.id);
      setIsLoading(false);
    };
    void loadConversations();
  }, []);

  useEffect(() => {
    if (!isLoading && conversations.length > 0) {
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    }
  }, [conversations, isLoading]);

  const updateActiveConversation = (updater: (conversation: Conversation) => Conversation) => {
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === activeId ? updater(conversation) : conversation,
      ),
    );
  };

  const startNewConversation = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = makeConversation(language);
    setConversations((current) => [next, ...current]);
    setActiveId(next.id);
    setDraft('');
    setPendingImage(undefined);
    setShowHistory(false);
  };

  const appendMessage = (message: Message) => {
    updateActiveConversation((conversation) => ({
      ...conversation,
      title:
        conversation.messages.length <= 1 && message.role === 'user'
          ? message.text.slice(0, 34) || t.newChat
          : conversation.title,
      updatedAt: new Date().toISOString(),
      messages: [...conversation.messages, message],
    }));
  };

  const sendMessage = async () => {
    const text = draft.trim();
    if (!text && !pendingImage) return;
    Keyboard.dismiss();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const image = pendingImage;
    setDraft('');
    setPendingImage(undefined);
    setIsSending(true);

    appendMessage({
      id: makeId(),
      role: 'user',
      text: text || (language === 'ht' ? 'Gade egzèsis sa a pou mwen.' : 'Analysez cet exercice pour moi.'),
      createdAt: new Date().toISOString(),
      imageUri: image,
    });

    try {
      const response = await aiChat.mutateAsync({
        data: {
          question:
            text ||
            (language === 'ht'
              ? 'Gade egzèsis sa a pou mwen.'
              : 'Analysez cet exercice pour moi.'),
          language,
        },
      });
      appendMessage({
        id: makeId(),
        role: 'assistant',
        text: response.message,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      const fallback =
        language === 'ht'
          ? 'IA a poko konekte. Backend Faroh IA a pare pou resevwa yon founisè IA pita.'
          : 'L’IA n’est pas encore connectée. Le backend Faroh IA est prêt pour ajouter un fournisseur plus tard.';
      appendMessage({
        id: makeId(),
        role: 'assistant',
        text: getApiMessage(error, fallback),
        createdAt: new Date().toISOString(),
      });
    } finally {
      setIsSending(false);
    }
  };

  const selectPhoto = async (source: 'camera' | 'gallery') => {
    setShowPhotoActions(false);
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(t.camera, t.cameraUnavailable);
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          quality: 0.85,
        });
        if (!result.canceled) setPendingImage(result.assets[0]?.uri);
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        quality: 0.85,
      });
      if (!result.canceled) setPendingImage(result.assets[0]?.uri);
    } catch {
      Alert.alert(t.attach, t.cameraUnavailable);
    }
  };

  const deleteConversation = (conversationId: string) => {
    Alert.alert(t.delete, t.deleteConfirm, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: () => {
          setConversations((current) => {
            const remaining = current.filter((conversation) => conversation.id !== conversationId);
            if (remaining.length === 0) {
              const fresh = makeConversation(language);
              setActiveId(fresh.id);
              return [fresh];
            }
            if (activeId === conversationId) setActiveId(remaining[0].id);
            return remaining;
          });
        },
      },
    ]);
  };

  const changeLanguage = (nextLanguage: Language) => {
    if (nextLanguage === language) return;
    void Haptics.selectionAsync();
    setLanguage(nextLanguage);
    Alert.alert(nextLanguage === 'ht' ? 'Kreyòl ayisyen' : 'Français', copy[nextLanguage].languageHint);
  };

  if (isLoading || !activeConversation) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior="padding"
      keyboardVerticalOffset={0}
    >
      <StatusBar barStyle="dark-content" />
      <View style={[styles.topArea, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <View style={styles.brandLockup}>
            <View style={styles.logoFrame}>
              <Image source={require('@/assets/images/faroh-icon.png')} style={styles.logo} />
            </View>
            <View>
              <Text style={styles.brandName}>Faroh IA</Text>
              <View style={styles.onlineRow}>
                <View style={styles.onlineDot} />
                <Text style={styles.onlineText}>{language === 'ht' ? 'Toujou pare pou ede w' : 'Toujours prêt à aider'}</Text>
              </View>
            </View>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              accessibilityLabel={t.history}
              testID="history-button"
              onPress={() => setShowHistory(true)}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            >
              <Feather name="clock" size={19} color={ink} />
            </Pressable>
            <Pressable
              accessibilityLabel={t.newChat}
              testID="new-chat-button"
              onPress={startNewConversation}
              style={({ pressed }) => [styles.newChatButton, pressed && styles.pressed]}
            >
              <Feather name="plus" size={17} color="#FFFFFF" />
              <Text style={styles.newChatText}>{t.newChat}</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.languageSwitch}>
          <Pressable
            testID="language-ht"
            onPress={() => changeLanguage('ht')}
            style={[styles.languageOption, language === 'ht' && styles.languageSelected]}
          >
            <Text style={[styles.languageText, language === 'ht' && styles.languageSelectedText]}>Kreyòl</Text>
          </Pressable>
          <Pressable
            testID="language-fr"
            onPress={() => changeLanguage('fr')}
            style={[styles.languageOption, language === 'fr' && styles.languageSelected]}
          >
            <Text style={[styles.languageText, language === 'fr' && styles.languageSelectedText]}>Français</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        inverted
        data={reversedMessages}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        scrollEnabled={reversedMessages.length > 0}
        contentContainerStyle={[
          styles.messageList,
          { paddingBottom: 18, paddingTop: 18 },
        ]}
        renderItem={({ item }) => (
          <View style={[styles.messageRow, item.role === 'user' && styles.userMessageRow]}>
            {item.role === 'assistant' && (
              <View style={styles.assistantAvatar}>
                <Feather name="star" size={15} color="#FFFFFF" />
              </View>
            )}
            <View style={[styles.messageColumn, item.role === 'user' && styles.userMessageColumn]}>
              <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.assistantBubble]}>
                {item.imageUri && <Image source={{ uri: item.imageUri }} style={styles.messageImage} />}
                <Text style={[styles.messageText, item.role === 'user' && styles.userMessageText]}>{item.text}</Text>
              </View>
              <Text style={[styles.messageTime, item.role === 'user' && styles.userMessageTime]}>
                {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          </View>
        )}
        ListHeaderComponent={
          isSending ? (
            <View style={styles.typingRow}>
              <View style={styles.assistantAvatar}>
                <Feather name="star" size={15} color="#FFFFFF" />
              </View>
              <View style={styles.typingBubble}>
                <View style={styles.typingDot} />
                <View style={[styles.typingDot, styles.typingDotMiddle]} />
                <View style={styles.typingDot} />
              </View>
            </View>
          ) : null
        }
      />

      {messages.length === 1 && (
        <View style={styles.suggestionsWrap}>
          <Text style={styles.suggestionsTitle}>{t.subjects}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subjectsRow}>
            {subjects.map((subject) => (
              <Pressable
                key={subject.label}
                onPress={() => setDraft(`${subject.label}: `)}
                style={({ pressed }) => [styles.subjectChip, pressed && styles.pressed]}
              >
                <Feather name={subject.icon} size={15} color={green} />
                <Text style={styles.subjectText}>{subject.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={[styles.composerArea, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'web' ? 34 : 10) }]}>
        {pendingImage && (
          <View style={styles.attachmentPreview}>
            <Image source={{ uri: pendingImage }} style={styles.previewImage} />
            <Text style={styles.previewText}>{language === 'ht' ? 'Foto pare pou voye' : 'Photo prête à envoyer'}</Text>
            <Pressable onPress={() => setPendingImage(undefined)} style={styles.removeAttachment}>
              <Feather name="x" size={15} color={softInk} />
            </Pressable>
          </View>
        )}
        <View style={styles.composer}>
          <Pressable
            accessibilityLabel={t.attach}
            testID="attach-photo-button"
            onPress={() => setShowPhotoActions(true)}
            style={({ pressed }) => [styles.attachButton, pressed && styles.pressed]}
          >
            <Feather name="paperclip" size={20} color={green} />
          </Pressable>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={() => void sendMessage()}
            placeholder={t.placeholder}
            placeholderTextColor="#9AA6AA"
            multiline
            maxLength={700}
            returnKeyType="send"
            style={styles.textInput}
            testID="question-input"
          />
          <Pressable
            accessibilityLabel={t.send}
            testID="send-button"
            onPress={() => void sendMessage()}
            disabled={isSending || (!draft.trim() && !pendingImage)}
            style={({ pressed }) => [
              styles.sendButton,
              (!draft.trim() && !pendingImage) && styles.sendButtonDisabled,
              pressed && styles.pressed,
            ]}
          >
            <Feather name="arrow-up" size={20} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      <Modal visible={showPhotoActions} transparent animationType="slide" onRequestClose={() => setShowPhotoActions(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowPhotoActions(false)}>
          <Pressable style={[styles.photoSheet, { paddingBottom: Math.max(insets.bottom, 20) }]} onPress={(event) => event.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{t.choosePhoto}</Text>
            <Pressable style={styles.sheetAction} onPress={() => void selectPhoto('camera')}>
              <View style={styles.sheetIcon}><Feather name="camera" size={20} color={green} /></View>
              <Text style={styles.sheetActionText}>{t.camera}</Text>
              <Feather name="chevron-right" size={18} color={softInk} />
            </Pressable>
            <Pressable style={styles.sheetAction} onPress={() => void selectPhoto('gallery')}>
              <View style={styles.sheetIcon}><Feather name="image" size={20} color={green} /></View>
              <Text style={styles.sheetActionText}>{t.gallery}</Text>
              <Feather name="chevron-right" size={18} color={softInk} />
            </Pressable>
            <Pressable style={styles.sheetCancel} onPress={() => setShowPhotoActions(false)}>
              <Text style={styles.sheetCancelText}>{t.cancel}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showHistory} transparent animationType="slide" onRequestClose={() => setShowHistory(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowHistory(false)}>
          <Pressable style={[styles.historySheet, { paddingBottom: Math.max(insets.bottom, 20) }]} onPress={(event) => event.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <View style={styles.historyHeader}>
              <View>
                <Text style={styles.sheetTitle}>{t.history}</Text>
                <Text style={styles.historySubtitle}>{conversations.length} {language === 'ht' ? 'konvèsasyon' : 'conversation(s)'}</Text>
              </View>
              <Pressable onPress={() => setShowHistory(false)} style={styles.closeButton}>
                <Feather name="x" size={20} color={ink} />
              </Pressable>
            </View>
            <FlatList
              data={conversations}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={<Text style={styles.emptyHistory}>{t.emptyHistory}</Text>}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    setActiveId(item.id);
                    setShowHistory(false);
                  }}
                  style={[styles.historyItem, item.id === activeId && styles.historyItemActive]}
                >
                  <View style={[styles.historyItemIcon, item.id === activeId && styles.historyItemIconActive]}>
                    <Feather name="message-circle" size={18} color={item.id === activeId ? '#FFFFFF' : green} />
                  </View>
                  <View style={styles.historyItemCopy}>
                    <Text numberOfLines={1} style={styles.historyItemTitle}>{item.title}</Text>
                    <Text style={styles.historyItemDate}>{formatConversationDate(item.updatedAt, language)} · {item.messages.length - 1} {language === 'ht' ? 'mesaj' : 'message(s)'}</Text>
                  </View>
                  <Pressable
                    accessibilityLabel={t.delete}
                    onPress={() => deleteConversation(item.id)}
                    hitSlop={12}
                    style={styles.deleteButton}
                  >
                    <Feather name="trash-2" size={16} color="#B8C0C2" />
                  </Pressable>
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: cream,
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: cream,
  },
  topArea: {
    backgroundColor: cream,
    paddingHorizontal: 20,
    paddingBottom: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E2',
  },
  headerRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  brandLockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  logoFrame: {
    width: 43,
    height: 43,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: navy,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  brandName: {
    color: navy,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  onlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: green,
  },
  onlineText: {
    color: softInk,
    fontSize: 11,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E3E8E8',
  },
  newChatButton: {
    height: 38,
    borderRadius: 13,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: primary,
  },
  newChatText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.72,
  },
  languageSwitch: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    padding: 3,
    marginTop: 10,
    borderRadius: 10,
    backgroundColor: '#EDEFEA',
  },
  languageOption: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  languageSelected: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#15232A',
    shadowOpacity: 0.08,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  languageText: {
    color: softInk,
    fontSize: 11,
    fontWeight: '600',
  },
  languageSelectedText: {
    color: ink,
  },
  messageList: {
    paddingHorizontal: 18,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginVertical: 6,
    maxWidth: '91%',
  },
  userMessageRow: {
    alignSelf: 'flex-end',
    justifyContent: 'flex-end',
  },
  assistantAvatar: {
    width: 29,
    height: 29,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: green,
    marginBottom: 18,
  },
  messageColumn: {
    alignItems: 'flex-start',
    flexShrink: 1,
  },
  userMessageColumn: {
    alignItems: 'flex-end',
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 18,
    maxWidth: '100%',
  },
  assistantBubble: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 5,
    borderWidth: 1,
    borderColor: '#E5E9E7',
  },
  userBubble: {
    backgroundColor: navy,
    borderTopRightRadius: 5,
  },
  messageText: {
    color: ink,
    fontSize: 15,
    lineHeight: 22,
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  messageTime: {
    color: '#98A3A5',
    fontSize: 10,
    marginTop: 4,
    marginHorizontal: 4,
  },
  userMessageTime: {
    textAlign: 'right',
  },
  messageImage: {
    width: 180,
    height: 132,
    borderRadius: 11,
    marginBottom: 8,
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 6,
  },
  typingBubble: {
    height: 35,
    borderRadius: 15,
    borderTopLeftRadius: 5,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E9E7',
  },
  typingDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#96A3A1',
  },
  typingDotMiddle: {
    backgroundColor: green,
  },
  suggestionsWrap: {
    paddingTop: 4,
    paddingBottom: 10,
  },
  suggestionsTitle: {
    color: softInk,
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  subjectsRow: {
    paddingHorizontal: 20,
    gap: 8,
  },
  subjectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E5F1EC',
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  subjectText: {
    color: green,
    fontSize: 11,
    fontWeight: '700',
  },
  composerArea: {
    paddingTop: 8,
    paddingHorizontal: 16,
    backgroundColor: cream,
  },
  composer: {
    minHeight: 53,
    maxHeight: 130,
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 6,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE5E3',
    shadowColor: '#273A3B',
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  attachButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: '#EAF5EF',
    marginRight: 6,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 110,
    color: ink,
    fontSize: 15,
    lineHeight: 21,
    paddingHorizontal: 5,
    paddingTop: 10,
    paddingBottom: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: primary,
  },
  sendButtonDisabled: {
    backgroundColor: '#D6DADB',
  },
  attachmentPreview: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    marginBottom: 7,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE5E3',
  },
  previewImage: {
    width: 34,
    height: 34,
    borderRadius: 8,
  },
  previewText: {
    flex: 1,
    color: softInk,
    fontSize: 12,
    fontWeight: '600',
  },
  removeAttachment: {
    padding: 7,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(23, 33, 43, 0.34)',
  },
  photoSheet: {
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    backgroundColor: cream,
  },
  historySheet: {
    maxHeight: '78%',
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    backgroundColor: cream,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    marginBottom: 18,
    backgroundColor: '#D0D8D8',
  },
  sheetTitle: {
    color: ink,
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  sheetAction: {
    minHeight: 63,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E9E6',
  },
  sheetIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: '#E5F1EC',
  },
  sheetActionText: {
    flex: 1,
    color: ink,
    fontSize: 15,
    fontWeight: '600',
  },
  sheetCancel: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 53,
    marginTop: 7,
    borderRadius: 15,
    backgroundColor: '#E9EDEB',
  },
  sheetCancelText: {
    color: ink,
    fontSize: 14,
    fontWeight: '700',
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  historySubtitle: {
    color: softInk,
    fontSize: 12,
    marginTop: 4,
  },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#E9EDEB',
  },
  historyItem: {
    minHeight: 67,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 9,
    borderRadius: 15,
    marginBottom: 5,
  },
  historyItemActive: {
    backgroundColor: '#E6F0EC',
  },
  historyItemIcon: {
    width: 39,
    height: 39,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#E5F1EC',
  },
  historyItemIconActive: {
    backgroundColor: green,
  },
  historyItemCopy: {
    flex: 1,
  },
  historyItemTitle: {
    color: ink,
    fontSize: 14,
    fontWeight: '700',
  },
  historyItemDate: {
    color: softInk,
    fontSize: 11,
    marginTop: 4,
  },
  deleteButton: {
    padding: 10,
  },
  emptyHistory: {
    color: softInk,
    fontSize: 14,
    lineHeight: 21,
    paddingVertical: 24,
    textAlign: 'center',
  },
});