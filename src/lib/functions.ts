export const getInitials = (name: string): string => {
  const words = name.split(" ");
  if (words.length === 1) {
    return words[0].slice(0, 2);
  } else {
    return `${words[0].charAt(0)}${words[1].charAt(0)}`;
  }
};

export const capitalizeFirstLetter = (text: string | null): string | null => {
  if (!text) return null;
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export const getCurrentTime = () => {
  const now = new Date();
  const currentTime = now.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
  return currentTime;
};

export function formatDateString(dateString: string) {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${year}/${month}/${day} ${hours}:${minutes}`;
}
