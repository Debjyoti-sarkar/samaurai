/**
 * EMI Calculator Service
 * Calculates loan EMIs, total interest, and generates amortization schedules
 */

function calculateEMI(principal, annualRate, tenureMonths) {
  const monthlyRate = annualRate / 12 / 100;
  
  if (monthlyRate === 0) {
    return principal / tenureMonths;
  }

  const emi = (principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) /
              (Math.pow(1 + monthlyRate, tenureMonths) - 1);
  
  return Math.round(emi * 100) / 100;
}

function calculateTotalPayment(emi, tenureMonths) {
  return Math.round(emi * tenureMonths * 100) / 100;
}

function calculateTotalInterest(totalPayment, principal) {
  return Math.round((totalPayment - principal) * 100) / 100;
}

function generateAmortizationSchedule(principal, annualRate, tenureMonths, startDate = new Date()) {
  const emi = calculateEMI(principal, annualRate, tenureMonths);
  const monthlyRate = annualRate / 12 / 100;
  
  let balance = principal;
  const schedule = [];
  
  for (let i = 1; i <= tenureMonths; i++) {
    const interestPayment = balance * monthlyRate;
    const principalPayment = emi - interestPayment;
    balance -= principalPayment;
    
    const dueDate = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + i);
    
    schedule.push({
      emiNumber: i,
      emiAmount: Math.round(emi * 100) / 100,
      principalComponent: Math.round(principalPayment * 100) / 100,
      interestComponent: Math.round(interestPayment * 100) / 100,
      remainingBalance: Math.max(0, Math.round(balance * 100) / 100),
      dueDate: dueDate,
      status: "pending",
    });
  }
  
  return schedule;
}

function calculateLoanDetails(principal, annualRate, tenureMonths) {
  const emi = calculateEMI(principal, annualRate, tenureMonths);
  const totalPayment = calculateTotalPayment(emi, tenureMonths);
  const totalInterest = calculateTotalInterest(totalPayment, principal);
  
  return {
    principalAmount: principal,
    interestRate: annualRate,
    tenureMonths: tenureMonths,
    emiAmount: emi,
    totalPayment: totalPayment,
    totalInterest: totalInterest,
    monthlyRate: annualRate / 12,
  };
}

function calculateEarlyPaymentSavings(remainingPrincipal, remainingMonths, annualRate, earlyPaymentAmount) {
  // Calculate current scenario
  const currentEMI = calculateEMI(remainingPrincipal, annualRate, remainingMonths);
  const currentTotal = calculateTotalPayment(currentEMI, remainingMonths);
  
  // Calculate new scenario after early payment
  const newPrincipal = remainingPrincipal - earlyPaymentAmount;
  const newEMI = calculateEMI(newPrincipal, annualRate, remainingMonths);
  const newTotal = calculateTotalPayment(newEMI, remainingMonths);
  
  const interestSaved = currentTotal - newTotal - earlyPaymentAmount;
  
  return {
    currentEMI,
    newEMI,
    emiReduction: currentEMI - newEMI,
    interestSaved: Math.round(interestSaved * 100) / 100,
    newRemainingPrincipal: newPrincipal,
  };
}

module.exports = {
  calculateEMI,
  calculateTotalPayment,
  calculateTotalInterest,
  generateAmortizationSchedule,
  calculateLoanDetails,
  calculateEarlyPaymentSavings,
};
