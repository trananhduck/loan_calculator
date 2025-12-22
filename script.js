const { createApp } = Vue;

createApp({
    data() {
        return {
            loanType: "BDS",
            creditRating: "AAA-BBB",
            loanTerm: 60, // Tháng
            loanAmount: 1000000000, // 1 tỷ mặc định
            prepayYear: 2, // Năm dự kiến trả trước hạn

            // Data LSTC (Phụ lục 02)
            refRates: [
                { max: 12, rate: 6.5 },
                { max: 60, rate: 7.5 },
                { max: 120, rate: 7.8 },
                { max: 9999, rate: 8.0 },
            ],

            // Data Biên độ (Phụ lục 04)
            marginsData: {
                BDS: {
                    "AAA-BBB": [{ max: 12, val: 1.45 }, { max: 60, val: 1.7 }, { max: 120, val: 1.8 }, { max: 9999, val: 1.91 }],
                    "BB-B": [{ max: 12, val: 2.09 }, { max: 60, val: 2.34 }, { max: 120, val: 2.44 }, { max: 9999, val: 2.54 }],
                    "CCC-D": [{ max: 12, val: 6.62 }, { max: 60, val: 6.87 }, { max: 120, val: 6.97 }, { max: 9999, val: 7.14 }],
                },
                SXKD: {
                    "AAA-BBB": [{ max: 12, val: 1.52 }, { max: 9999, val: 1.72 }],
                    "BB-B": [{ max: 12, val: 2.0 }, { max: 9999, val: 2.2 }],
                    "CCC-D": [{ max: 12, val: 5.62 }, { max: 9999, val: 5.82 }],
                },
                OTO: {
                    "AAA-BBB": [{ max: 12, val: 1.47 }, { max: 9999, val: 1.57 }],
                    "BB-B": [{ max: 12, val: 2.05 }, { max: 9999, val: 2.15 }],
                    "CCC-D": [{ max: 12, val: 6.69 }, { max: 9999, val: 6.79 }],
                },
                TIEUDUNG_TSBD: {
                    "AAA-BBB": [{ max: 12, val: 1.55 }, { max: 9999, val: 1.75 }],
                    "BB-B": [{ max: 12, val: 2.54 }, { max: 9999, val: 2.74 }],
                    "CCC-D": [{ max: 12, val: 5.69 }, { max: 9999, val: 5.89 }],
                },
            },
        };
    },
    computed: {
        // --- 1. TÍNH LÃI SUẤT ---
        baseRate() {
            if (!this.loanTerm || this.loanTerm <= 0) return 0;
            const found = this.refRates.find((r) => this.loanTerm <= r.max);
            return found ? found.rate : 8.0;
        },
        margin() {
            if (!this.loanTerm || this.loanTerm <= 0) return 0;
            const productMargins = this.marginsData[this.loanType];
            if (!productMargins) return 0;
            const ratingMargins = productMargins[this.creditRating];
            if (!ratingMargins) return 0;
            const found = ratingMargins.find((m) => this.loanTerm <= m.max);
            return found ? found.val : ratingMargins[ratingMargins.length - 1].val;
        },
        finalRate() {
            return parseFloat((this.baseRate + this.margin).toFixed(2));
        },

        // --- 2. TÍNH SỐ TIỀN TRẢ HÀNG THÁNG (Dư nợ giảm dần) ---
        monthlyInterestRate() {
            return this.finalRate / 100 / 12;
        },
        // Gốc trả hàng tháng (đều)
        principalPerMonth() {
            return this.loanTerm > 0 ? this.loanAmount / this.loanTerm : 0;
        },
        // Tiền trả tháng đầu tiên (Cao nhất)
        firstMonthPayment() {
            const interestFirstMonth = this.loanAmount * this.monthlyInterestRate;
            return this.principalPerMonth + interestFirstMonth;
        },
        // Tổng lãi phải trả (Ước tính gần đúng)
        totalInterest() {
            // Công thức tổng lãi dư nợ giảm dần: Tổng lãi = P * i * (n+1) / 2
            return (this.loanAmount * this.monthlyInterestRate * (this.loanTerm + 1)) / 2;
        },

        // --- 3. TÍNH DƯ NỢ CÒN LẠI VÀ PHÍ PHẠT ---
        // Dư nợ còn lại tại thời điểm trả trước hạn (Cuối năm thứ X)
        remainingPrincipal() {
            const monthsPassed = this.prepayYear * 12;
            if (monthsPassed >= this.loanTerm) return 0; // Đã trả hết theo lịch

            // Dư nợ còn lại = Tổng vay - (Gốc tháng * số tháng đã qua)
            const paidPrincipal = this.principalPerMonth * monthsPassed;
            return Math.max(0, this.loanAmount - paidPrincipal);
        },

        // Tỷ lệ phí phạt (Logic từ Phụ lục 03)
        penaltyRate() {
            const year = this.prepayYear;

            // Logic cho BĐS & TIEUDUNG_TSBD (Phổ biến nhất)
            // Năm 1-3: 2.5% | Năm 4: 1.5% | Năm 5: 1% | >5: Miễn phí
            if (this.loanType === 'BDS' || this.loanType === 'TIEUDUNG_TSBD') {
                if (year <= 3) return 2.5;
                if (year === 4) return 1.5;
                if (year === 5) return 1.0;
                return 0;
            }

            // Logic cho OTO (Thường cao hơn)
            // Năm 1-2: 3% | Năm 3: 2% | Năm 4: 1.5% | >4: Miễn phí
            if (this.loanType === 'OTO') {
                if (year <= 2) return 3.0;
                if (year === 3) return 2.0;
                if (year === 4) return 1.5;
                return 0;
            }

            // Logic cho SXKD (Thường ngắn hạn)
            // Năm 1: 1.5% | Năm 2+: 0% (Giả định đơn giản hóa vì SXKD thường vay ngắn)
            if (this.loanType === 'SXKD') {
                if (year <= 1) return 1.5;
                return 0;
            }

            return 0;
        },

        penaltyAmount() {
            return this.remainingPrincipal * (this.penaltyRate / 100);
        },

        totalPrepayAmount() {
            return this.remainingPrincipal + this.penaltyAmount;
        }
    },
    methods: {
        // Hàm định dạng tiền tệ (1.000.000 đ)
        formatCurrency(value) {
            if (!value) return "0 đ";
            return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
        },
        // Format input khi nhập liệu (thêm dấu phẩy)
        formatInputMoney(value) {
            if (!value) return "";
            return new Intl.NumberFormat('en-US').format(value);
        },
        // Xử lý khi nhập số tiền (bỏ dấu phẩy để lưu vào data)
        updateLoanAmount(event) {
            const val = event.target.value.replace(/,/g, '');
            this.loanAmount = parseFloat(val) || 0;
            // Force update để hiển thị lại dấu phẩy
            event.target.value = this.formatInputMoney(this.loanAmount);
        }
    }
}).mount("#app");