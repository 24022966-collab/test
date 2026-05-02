import { localStorageManager } from './localStorageManager.js';

const STORAGE_KEY = 'UET_CAMPUS_DRIVE_SAVE';

export const saveSystem = {
    // Khởi tạo dữ liệu cụ thể cho game
    getInitialData() {
        return {
            gold: 0,                   // Số vàng nhặt được
            ownedCars: ['car_01'],     // Danh sách xe đã mua
            currentCar: 'car_01',      // Xe đang sử dụng
            bestTime: 9999              // Kỷ lục thời gian đua
        };
    },

    loadGame() {
        const data = localStorageManager.get(STORAGE_KEY);
        return data ? data : this.getInitialData();
    },

    saveGame(data) {
        localStorageManager.set(STORAGE_KEY, data);
    },

    // Hàm cụ thể để nhóm trưởng/dev chính dễ gọi
    updateGold(amount) {
        const data = this.loadGame();
        data.gold += amount;
        this.saveGame(data);
    }
};
