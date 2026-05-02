/**
 * Xử lý việc đọc/ghi chuỗi String từ trình duyệt và chuyển thành Object/Number
 */
export const localStorageManager = {
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error("Lỗi lưu trữ:", e);
        }
    },
    get(key) {
        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : null;
        } catch (e) {
            return null;
        }
    }
};
