import * as THREE from 'three';

export class AudioManager {
    constructor(camera) {
        this.listener = new THREE.AudioListener();
        camera.add(this.listener);
        this.audioLoader = new THREE.AudioLoader();
        this.sounds = {};
        
        this.bgmList = [
            'AmThanh/TaiFile_MP4_MP3/nhac_nen/MỘT VÒNG VIỆT NAM.mp3', 
            'AmThanh/TaiFile_MP4_MP3/nhac_nen/OneRepublic - Counting Stars - YouTube.mp3', 
            'AmThanh/TaiFile_MP4_MP3/nhac_nen/TRỐNG CƠM - HOÀ TẤU KHÔNG LỜI.mp3',
            'AmThanh/TaiFile_MP4_MP3/nhac_nen/Uptown Funk.mp3'
        ];
    }

    loadAllSounds() {
        // --- ÂM THANH CƠ BẢN ---
        const randomBgm = this.bgmList[Math.floor(Math.random() * this.bgmList.length)];
        this.loadSound('bgm', randomBgm, true, 0.2);
        this.loadSound('crash', 'AmThanh/TaiFile_MP4_MP3/am_thanh_co_ban/va_cham.mp3', false, 0.7);
        this.loadSound('collect', 'AmThanh/TaiFile_MP4_MP3/am_thanh_co_ban/nhat_coin.mp3', false, 0.5);
        this.loadSound('brake', 'AmThanh/TaiFile_MP4_MP3/am_thanh_co_ban/tieng_phanh.mp3', false, 0.5);
        this.loadSound('horn', 'AmThanh/TaiFile_MP4_MP3/am_thanh_co_ban/coi_xe.mp3', false, 0.4);

        // --- BỔ SUNG: TIẾNG Ô TÔ CHẠY & ĐỨNG YÊN ---
        // Tiếng nổ máy khi đứng yên (Garanti)
        this.loadSound('engine_idle', 'AmThanh/TaiFile_MP4_MP3/am_thanh_co_ban/xe_dung_yen.mp3', true, 0.3);
        // Tiếng động cơ khi đang chạy nhanh
        this.loadSound('engine_run', 'AmThanh/TaiFile_MP4_MP3/am_thanh_co_ban/xe_chay1.mp3', true, 0.5);

        // --- HỆ THỐNG XE ĐẶC BIỆT ---
        this.loadSound('police_siren', 'audio/canh_sat_hu.mp3', true, 0.5);
        this.loadSound('tank_engine', 'audio/dong_co_xe_tang.mp3', true, 0.6);
        this.loadSound('royce_engine', 'audio/royce_em_ai.mp3', true, 0.3);

        // --- HỆ THỐNG TRỰC THĂNG ---
        this.loadSound('heli_startup', 'audio/heli_cat_canh.mp3', false, 0.6);
        this.loadSound('heli_idle', 'audio/heli_bay.mp3', true, 0.5);
        this.loadSound('heli_land', 'audio/heli_ha_canh.mp3', false, 0.6);

        // --- UI ---
        this.loadSound('clickShop', 'audio/ui_click_shop.mp3', false, 0.4);
        this.loadSound('clickInfo', 'audio/ui_click_info.mp3', false, 0.4);
    }

    loadSound(name, url, loop, volume) {
        const sound = new THREE.Audio(this.listener);
        this.audioLoader.load(url, (buffer) => {
            sound.setBuffer(buffer);
            sound.setLoop(loop);
            sound.setVolume(volume);
            this.sounds[name] = sound;
        });
    }

    play(name) {
        if (this.sounds[name] && !this.sounds[name].isPlaying) {
            this.sounds[name].play();
        }
    }

    stop(name) {
        if (this.sounds[name] && this.sounds[name].isPlaying) {
            this.sounds[name].stop();
        }
    }

    stopAllEngines() {
        // Cập nhật danh sách bao gồm cả tiếng đứng yên và chạy
        const engines = [
            'engine_idle', 'engine_run', 'police_siren', 
            'tank_engine', 'royce_engine', 'heli_idle'
        ];
        
        engines.forEach(vehicleName => {
            if (this.sounds[vehicleName] && this.sounds[vehicleName].isPlaying) {
                this.sounds[vehicleName].stop();
            }
        });
    }

    switchVehicle(newVehicleName) {
        this.stopAllEngines();
        this.play(newVehicleName);
    }
}