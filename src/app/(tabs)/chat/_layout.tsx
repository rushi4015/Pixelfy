import { Stack } from "expo-router";
import ChatProvider from "~/src/provider/ChatProvider";

export default function ChatLayout() {
    return (
        <ChatProvider>
            <Stack>
                <Stack.Screen 
                    name="index" 
                    options={{ 
                        title: "Messages" 
                    }} 
                />
                <Stack.Screen 
                    name="channel/[id]" 
                    options={{ 
                        title: "Channel" 
                    }} 
                />
            </Stack>
        </ChatProvider>
    );
}
