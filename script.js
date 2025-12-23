const { createApp } = Vue;

createApp({
    data() {
        return {
            loanType: "BDS",
            creditRating: "AAA-BBB",
            loanTerm: 60,
            loanAmount: 1000000000,
            prepayYear: 2,
            paymentFreq: 1,

            // 1. DỮ LIỆU LSTC & MÃ KEY (Phụ lục 02 - Từ hình ảnh a03ec1.png)
            refRates: [
                { max: 12, rate: 6.5, key: "68" },   // ≤ 1 năm
                { max: 60, rate: 7.5, key: "49" },   // > 1 năm đến ≤ 5 năm
                { max: 120, rate: 7.8, key: "70" },  // > 5 năm đến ≤ 10 năm
                { max: 9999, rate: 8.0, key: "26" }, // > 10 năm
            ],

            // 2. DỮ LIỆU BIÊN ĐỘ MỚI (Phụ lục 04 - Từ hình ảnh a03ec8.png)
            // Cấu trúc mốc thời gian (max): 
            // 12 (≤1 năm) | 60 (≤5 năm) | 120 (≤10 năm) | 9999 (>10 năm)
            marginsData: {
                BDS: {
                    "AAA-BBB": [
                        { max: 12, val: 1.5 }, { max: 60, val: 1.3 }, { max: 120, val: 1.7 }, { max: 9999, val: 1.8 }
                    ],
                    "BB-B": [
                        { max: 12, val: 2.1 }, { max: 60, val: 2.0 }, { max: 120, val: 2.4 }, { max: 9999, val: 2.5 }
                    ],
                    "CCC-D": [
                        { max: 12, val: 6.7 }, { max: 60, val: 7.5 }, { max: 120, val: 6.9 }, { max: 9999, val: 7.0 }
                    ],
                },
                SXKD: {
                    "AAA-BBB": [
                        { max: 12, val: 1.0 }, { max: 60, val: 0.5 }, { max: 120, val: 0.9 }, { max: 9999, val: 1.1 }
                    ],
                    "BB-B": [
                        { max: 12, val: 1.5 }, { max: 60, val: 1.1 }, { max: 120, val: 1.6 }, { max: 9999, val: 1.8 }
                    ],
                    "CCC-D": [
                        { max: 12, val: 5.6 }, { max: 60, val: 5.2 }, { max: 120, val: 5.7 }, { max: 9999, val: 5.9 }
                    ],
                },
                OTO: {
                    "AAA-BBB": [
                        { max: 12, val: 1.6 }, { max: 60, val: 1.6 }, { max: 120, val: 2.0 }, { max: 9999, val: 2.0 }
                    ],
                    "BB-B": [
                        { max: 12, val: 2.1 }, { max: 60, val: 2.1 }, { max: 120, val: 2.5 }, { max: 9999, val: 2.5 }
                    ],
                    "CCC-D": [
                        { max: 12, val: 6.7 }, { max: 60, val: 6.8 }, { max: 120, val: 7.2 }, { max: 9999, val: 7.2 }
                    ],
                },
                TIEUDUNG_TSBD: {
                    "AAA-BBB": [
                        { max: 12, val: 2.0 }, { max: 60, val: 1.9 }, { max: 120, val: 2.4 }, { max: 9999, val: 2.4 }
                    ],
                    "BB-B": [
                        { max: 12, val: 2.6 }, { max: 60, val: 2.6 }, { max: 120, val: 3.0 }, { max: 9999, val: 3.0 }
                    ],
                    "CCC-D": [
                        { max: 12, val: 5.6 }, { max: 60, val: 5.8 }, { max: 120, val: 6.2 }, { max: 9999, val: 6.2 }
                    ],
                },
            },
        };
    },
    computed: {
        // --- TÌM DỮ LIỆU LSTC VÀ KEY ---
        refData() {
            if (!this.loanTerm || this.loanTerm <= 0) return null;
            return this.refRates.find((r) => this.loanTerm <= r.max) || this.refRates[this.refRates.length - 1];
        },
        baseRate() { return this.refData ? this.refData.rate : 8.0; },
        baseRateKey() { return this.refData ? this.refData.key : "--"; }, // Lấy mã Key

        // --- TÍNH BIÊN ĐỘ ---
        margin() {
            if (!this.loanTerm || this.loanTerm <= 0) return 0;
            const productMargins = this.marginsData[this.loanType];
            if (!productMargins) return 0;
            const ratingMargins = productMargins[this.creditRating];
            if (!ratingMargins) return 0;
            const found = ratingMargins.find((m) => this.loanTerm <= m.max);
            return found ? found.val : ratingMargins[ratingMargins.length - 1].val;
        },

        // --- TÍNH PHÍ CỘNG THÊM ---
        surcharge() {
            if (this.paymentFreq >= 4) return 0.25;
            if (this.paymentFreq >= 2) return 0.15;
            return 0;
        },

        // --- LÃI SUẤT FINAL ---
        finalRate() {
            return parseFloat((this.baseRate + this.margin + this.surcharge).toFixed(2));
        },

        // --- CÁC PHẦN TÍNH TOÁN KHÁC (GIỮ NGUYÊN) ---
        monthlyInterestRate() { return this.finalRate / 100 / 12; },
        principalPerMonth() { return this.loanTerm > 0 ? this.loanAmount / this.loanTerm : 0; },
        firstMonthPayment() {
            const interestFirstMonth = this.loanAmount * this.monthlyInterestRate;
            return this.principalPerMonth + interestFirstMonth;
        },
        totalInterest() {
            return (this.loanAmount * this.monthlyInterestRate * (this.loanTerm + 1)) / 2;
        },
        remainingPrincipal() {
            const monthsPassed = this.prepayYear * 12;
            if (monthsPassed >= this.loanTerm) return 0;
            const paidPrincipal = this.principalPerMonth * monthsPassed;
            return Math.max(0, this.loanAmount - paidPrincipal);
        },
        penaltyRate() {
            const year = this.prepayYear;
            if (this.loanType === 'BDS') {
                if (year <= 3) return 2.5;
                if (year === 4) return 1.5;
                if (year === 5) return 1.0;
                return 0;
            }
            if (this.loanType === 'SXKD') {
                if (year <= 1) return 0.5;
                return 0.5;
            }
            if (this.loanType === 'OTO') {
                if (year <= 2) return 3.0;
                if (year === 3) return 2.0;
                if (year === 4) return 1.5;
                return 0;
            }
            if (this.loanType === 'TIEUDUNG_TSBD') {
                if (year <= 2) return 2.5;
                if (year === 3) return 2.0;
                if (year === 4) return 1.5;
                if (year === 5) return 1.0;
                return 0;
            }
            return 0;
        },
        penaltyAmount() { return this.remainingPrincipal * (this.penaltyRate / 100); },
        totalPrepayAmount() { return this.remainingPrincipal + this.penaltyAmount; }
    },
    methods: {
        formatCurrency(value) {
            if (!value) return "0 đ";
            return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
        },
        formatInputMoney(value) {
            if (!value) return "";
            return new Intl.NumberFormat('en-US').format(value);
        },
        updateLoanAmount(event) {
            const val = event.target.value.replace(/,/g, '');
            this.loanAmount = parseFloat(val) || 0;
            event.target.value = this.formatInputMoney(this.loanAmount);
        }
    }
}).mount("#app");