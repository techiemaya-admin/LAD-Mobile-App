
const fs = require("fs");
let content = fs.readFileSync("src/store/chatStore.ts", "utf8");

if (!content.includes("sendLocation: (latitude: number")) {
  content = content.replace(
    "sendAttachment: (asset: AttachmentAsset, caption?: string) => Promise<void>;",
    "sendLocation: (latitude: number, longitude: number, locationName: string, locationAddress?: string) => Promise<void>;\n  sendAttachment: (asset: AttachmentAsset, caption?: string) => Promise<void>;"
  );
}

const sendLocationImpl = `
  sendLocation: async (latitude, longitude, locationName, locationAddress) => {
    const activeConversationId = get().activeConversationId;
    if (!activeConversationId) return;

    const clientId = \`local-\${Date.now()}\`;
    const locationUrl = \`https://maps.google.com/?q=\${latitude},\${longitude}\`;
    
    const optimisticMessage = {
      id: clientId,
      conversationId: activeConversationId,
      content: locationUrl,
      sender: "agent",
      channel: get().conversations.find((c) => c.id === activeConversationId)?.channel || "whatsapp",
      status: "sending",
      createdAt: new Date().toISOString(),
      type: "location",
      latitude,
      longitude,
      locationName,
      locationAddress,
    };

    set((state) => ({
      isSending: true,
      activeMessages: [...state.activeMessages, optimisticMessage],
    }));

    try {
      const currentUser = useAuthStore.getState().user;
      const returnedMsg = await sendChatMessage({
        conversationId: activeConversationId,
        message: "Location shared",
        content: locationUrl,
        type: "location",
        latitude,
        longitude,
        locationName,
        locationAddress,
        humanAgentId: currentUser?.id,
        currentUser,
        role: "user",
      });

      set((state) => {
        const newActiveMessages = state.activeMessages.filter(m => m.id !== clientId);
        if (returnedMsg) newActiveMessages.push(returnedMsg);
        
        const convMessages = (state.messagesByConversationId[activeConversationId] || []).filter(m => m.id !== clientId);
        if (returnedMsg) convMessages.push(returnedMsg);

        return {
          isSending: false,
          activeMessages: newActiveMessages,
          messagesByConversationId: {
            ...state.messagesByConversationId,
            [activeConversationId]: convMessages,
          },
        };
      });
    } catch (error) {
      set((state) => ({
        isSending: false,
        activeMessages: state.activeMessages.filter(m => m.id !== clientId),
        error: getErrorMessage(error, "Location failed to send."),
      }));
    }
  },
`;

const sendAttachmentImpl = `
  sendAttachment: async (asset, caption?: string) => {
    const activeConversationId = get().activeConversationId;
    if (!activeConversationId || !asset.uri) {
      return;
    }

    const optimisticMessageId = \`optimistic-\${Date.now()}\`;
    const optimisticMessage = {
      id: optimisticMessageId,
      conversationId: activeConversationId,
      content: caption || asset.name || "Attachment",
      sender: "agent",
      channel: get().conversations.find((c) => c.id === activeConversationId)?.channel || "whatsapp",
      status: "sending",
      createdAt: new Date().toISOString(),
      mediaId: asset.uri,
      mediaType: asset.mimeType?.startsWith("image/") ? "image" 
               : asset.mimeType?.startsWith("video/") ? "video" 
               : asset.mimeType?.startsWith("audio/") ? "audio" 
               : "document",
      mediaMimeType: asset.mimeType ?? undefined,
      mediaFilename: asset.name,
      mediaCaption: caption,
    };

    set((state) => ({
      isUploadingAttachment: true,
      error: null,
      activeMessages: [...state.activeMessages, optimisticMessage],
    }));

    try {
      const conversation = get().conversations.find((c) => c.id === activeConversationId);
      const rawChannel = conversation?.waBackendChannel || "personal";
      const apiChannel = rawChannel === "waba" ? "waba" : "personal";

      let mediaType = "document";
      if (asset.mimeType?.startsWith("image/")) mediaType = "image";
      else if (asset.mimeType?.startsWith("video/")) mediaType = "video";
      else if (asset.mimeType?.startsWith("audio/")) mediaType = "audio";

      if (require("react-native").Platform.OS !== "web") {
        const token = await getAuthToken();
        const wapaBase = (process.env.EXPO_PUBLIC_WAPA_SERVICE_URL || "https://lad-wapa-comms-develop-asia-160078175457.asia-south1.run.app").replace(/\\/+$/, "");
        const bniBase = (process.env.EXPO_PUBLIC_BNI_SERVICE_URL || process.env.EXPO_PUBLIC_WHATSAPP_API_URL || "https://lad-waba-comms-develop-asia-160078175457.asia-south1.run.app").replace(/\\/+$/, "");
        const uploadBase = apiChannel === "waba" ? bniBase : wapaBase;
        const uploadPath = apiChannel === "waba"
          ? "/api/conversations/upload-media"
          : "/api/whatsapp-conversations/conversations/upload-media";
        const uploadUrl = \`\${uploadBase}\${uploadPath}?channel=\${apiChannel}\`;

        const nativeForm = new FormData();
        nativeForm.append("file", {
          uri: asset.uri,
          name: asset.name || \`attachment-\${Date.now()}\`,
          type: asset.mimeType || "application/octet-stream",
        });
        nativeForm.append("conversationId", activeConversationId);
        nativeForm.append("type", mediaType);
        if (caption) nativeForm.append("caption", caption);

        const uploadResult = await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", uploadUrl);
          if (token) xhr.setRequestHeader("Authorization", \`Bearer \${token}\`);
          xhr.timeout = 60000;
          xhr.onload = () => resolve({ status: xhr.status, body: xhr.responseText });
          xhr.onerror = () => reject(new Error("Network error during upload"));
          xhr.ontimeout = () => reject(new Error("Upload timed out"));
          xhr.send(nativeForm);
        });

        if (uploadResult.status >= 400) {
          let errMsg = "Failed to upload media.";
          try {
            const errBody = JSON.parse(uploadResult.body);
            errMsg = String(errBody.message || errBody.error || errMsg);
          } catch {}
          throw new Error(errMsg);
        }

        let uploadData = {};
        try { uploadData = JSON.parse(uploadResult.body); } catch {}
        const nested = uploadData?.data;
        const uploadedMediaId = String(nested?.media_id ?? uploadData?.media_id ?? uploadData?.url ?? "");

        if (!uploadedMediaId) {
          throw new Error("Media upload did not return a media ID.");
        }

        const returnedMsg = await sendChatMessage({
          conversationId: activeConversationId,
          message: caption || asset.name || "Media",
          content: uploadedMediaId,
          role: "user",
          type: mediaType,
          mediaId: uploadedMediaId,
          mediaType: mediaType,
          mediaFilename: asset.name || \`attachment-\${Date.now()}\`,
          mediaCaption: caption || undefined,
        });

        set((state) => {
          const newActiveMessages = state.activeMessages.filter(m => m.id !== optimisticMessageId);
          if (returnedMsg) newActiveMessages.push(returnedMsg);
          const convMessages = (state.messagesByConversationId[activeConversationId] || []).filter(m => m.id !== optimisticMessageId);
          if (returnedMsg) convMessages.push(returnedMsg);
          return {
            isUploadingAttachment: false,
            activeMessages: newActiveMessages,
            messagesByConversationId: {
              ...state.messagesByConversationId,
              [activeConversationId]: convMessages,
            },
          };
        });
      } else {
        const formData = new FormData();
        formData.append("conversationId", activeConversationId);
        formData.append("channel", apiChannel);
        if (caption) formData.append("caption", caption);
        formData.append("type", mediaType);

        let fileData = asset.file;
        if (!fileData) {
          const response = await fetch(asset.uri);
          const blob = await response.blob();
          const effectiveMimeType = blob.type || asset.mimeType || asset.type || "application/octet-stream";
          let fileName = asset.name || \`attachment-\${Date.now()}\`;
          if (effectiveMimeType.startsWith("audio/webm") && fileName.endsWith(".m4a")) {
            fileName = fileName.replace(/\\.m4a$/, ".webm");
          } else if (effectiveMimeType.startsWith("audio/ogg") && fileName.endsWith(".m4a")) {
            fileName = fileName.replace(/\\.m4a$/, ".ogg");
          }
          fileData = new File([blob], fileName, { type: effectiveMimeType });
        }
        formData.append("file", fileData);
        await sendMessageWithAttachment(formData);
        
        set((state) => ({
          isUploadingAttachment: false,
          activeMessages: state.activeMessages.filter(m => m.id !== optimisticMessageId)
        }));
        await get().setActiveConversation(activeConversationId, { force: true });
      }
    } catch (error) {
      set((state) => ({
        isUploadingAttachment: false,
        activeMessages: state.activeMessages.filter(m => m.id !== optimisticMessageId),
        error: getErrorMessage(error, "Attachment failed to upload."),
      }));
    }
  }
`;

const sendAttachmentRegex = /sendAttachment:\s*async\s*\([^)]*\)\s*=>\s*\{[\s\S]*?(?=,\s*sendChannelMessage:)/;
if (sendAttachmentRegex.test(content)) {
  content = content.replace(sendAttachmentRegex, (sendLocationImpl + sendAttachmentImpl).trimEnd());
} else {
  console.log("Could not find sendAttachment block to replace");
}

fs.writeFileSync("src/store/chatStore.ts", content, "utf8");
console.log("Done");

