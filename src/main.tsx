import ReactDOM from "react-dom/client";
import { store } from "./utils/vars";
import { ThemeProvider } from "./components/theme-provide";
import { Provider } from "jotai";
import App from "./App";
import ErrorBoundary from "./utils/errorCatcher";
import Decorations from "./utils/decorations";
import ResizeHandles from "./utils/ResizeHandles";
import { interceptConsole } from "@fltsci/tauri-plugin-tracing";
import { invoke } from "@tauri-apps/api/core";
import { setDataPath } from "./utils/init";

window.addEventListener("keydown", (e) => {
	if (e.key === "F8") {
		e.preventDefault();
		invoke('open_logs_folder');
	}
});

setDataPath()

// Intercept console logs and send them to Rust for file saving, etc.
interceptConsole({ preserveOriginal: true });

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
	<Provider store={store}>
		<ThemeProvider defaultTheme="dark">
			<ErrorBoundary>
				<Decorations />
				<ResizeHandles />
				<App />
			</ErrorBoundary>
		</ThemeProvider>
	</Provider>
);
