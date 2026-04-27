/// <reference types="vite/client" />

// Vite ?raw suffix returns the file content as a string
declare module '*?raw' {
  const content: string;
  export default content;
}
