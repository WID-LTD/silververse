document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('regForm');
  const fileUpload = document.getElementById('fileUpload');
  const receiptFile = document.getElementById('receiptFile');
  const fileName = document.getElementById('fileName');

  let flwPublicKey = '';
  let flwEnabled = false;

  // Fetch payment config
  fetch('/api/payment/config').then(r => r.json()).then(d => {
    flwEnabled = d.enabled;
    flwPublicKey = d.publicKey;
    if (flwEnabled && !document.getElementById('flw-inline-script')) {
      const script = document.createElement('script');
      script.id = 'flw-inline-script';
      script.src = 'https://checkout.flutterwave.com/js/flutterwave.js';
      document.head.appendChild(script);
    }
  }).catch(() => {});

  // Toggle sub-fields based on category
  document.querySelectorAll('input[name="category"]').forEach(radio => {
    radio.addEventListener('change', function () {
      const cat = this.value;
      document.getElementById('contestantFields').style.display = cat === 'Contestant' ? 'block' : 'none';
      document.getElementById('volunteerFields').style.display = cat === 'Volunteer' ? 'block' : 'none';

      const ticketSelect = document.getElementById('ticketType');
      if (cat === 'Judge' || cat === 'Speaker' || cat === 'Sponsor') {
        ticketSelect.value = 'VIP';
      } else if (cat === 'Volunteer' || cat === 'Media' || cat === 'Staff') {
        ticketSelect.value = 'Regular';
      }
    });
  });

  // File upload
  fileUpload.addEventListener('click', () => receiptFile.click());
  fileUpload.addEventListener('dragover', (e) => {
    e.preventDefault();
    fileUpload.style.borderColor = 'var(--primary)';
  });
  fileUpload.addEventListener('dragleave', () => {
    fileUpload.style.borderColor = 'var(--gray-300)';
  });
  fileUpload.addEventListener('drop', (e) => {
    e.preventDefault();
    fileUpload.style.borderColor = 'var(--gray-300)';
    if (e.dataTransfer.files.length) {
      receiptFile.files = e.dataTransfer.files;
      showFileName(e.dataTransfer.files[0]);
    }
  });
  receiptFile.addEventListener('change', function () {
    if (this.files.length) showFileName(this.files[0]);
  });

  function showFileName(file) {
    fileName.textContent = file.name + ' (' + (file.size / 1024).toFixed(1) + ' KB)';
  }

  // Payment summary update
  const summaryTicket = document.getElementById('summaryTicketType');
  const summaryAmount = document.getElementById('summaryAmount');
  const PRICES_MAP = { Regular: 3000, VIP: 5000, VVIP: 10000 };

  function updateSummary() {
    const type = form.ticketType.value;
    summaryTicket.textContent = type;
    summaryAmount.textContent = '\u20A6' + PRICES_MAP[type].toLocaleString();
  }
  form.ticketType.addEventListener('change', updateSummary);
  updateSummary();

  const PRICES = { Regular: 3000, VIP: 5000, VVIP: 10000 };

  function launchFlutterwavePayment(regId, data) {
    const amount = PRICES[data.ticketType] || 3000;

    if (typeof Flutterwave === 'undefined') {
      app.showToast('Payment gateway loading, please try again.', 'error');
      return;
    }

    FlutterwaveCheckout({
      public_key: flwPublicKey,
      tx_ref: regId,
      amount: amount,
      currency: 'NGN',
      country: 'NG',
      payment_options: 'card,mobilemoney,ussd,banktransfer',
      customer: {
        email: data.email,
        phone_number: data.phone,
        name: data.firstName + ' ' + data.lastName,
      },
      customizations: {
        title: 'Voices & Visions Festival 2026',
        description: data.ticketType + ' Ticket — ' + data.category,
        logo: '',
      },
      callback: function (response) {
        if (response.status === 'successful') {
          app.showToast('Payment successful! Redirecting...');
          setTimeout(() => {
            window.location.href = 'ticket.html?id=' + regId;
          }, 1500);
        } else {
          app.showToast('Payment was not completed. You can still attend with manual verification.', 'error');
          setTimeout(() => {
            window.location.href = 'receipt.html?id=' + regId;
          }, 2000);
        }
      },
      onclose: function () {
        app.showToast('Payment cancelled. Your registration is saved.', 'error');
      },
    });
  }

  // Submit
  form.addEventListener('submit', function (e) {
    e.preventDefault();

    if (!document.getElementById('agree').checked) {
      app.showToast('Please agree to the terms and conditions.', 'error');
      return;
    }

    const data = {
      firstName: form.firstName.value.trim(),
      lastName: form.lastName.value.trim(),
      email: form.email.value.trim(),
      phone: form.phone.value.trim(),
      category: form.category.value,
      ticketType: form.ticketType.value,
      talent: form.talent ? form.talent.value : '',
      perfTime: form.perfTime ? form.perfTime.value : '',
      department: form.department ? form.department.value : '',
      dietary: form.dietary ? form.dietary.value : ''
    };

    const saved = app.save(data);

    // Show success
    form.style.display = 'none';
    document.getElementById('registerSuccess').style.display = 'block';
    document.getElementById('displayRegId').textContent = saved.regId;

    app.showToast('Registration successful! Your ID: ' + saved.regId);

    // Launch payment if Flutterwave is enabled
    if (flwEnabled) {
      setTimeout(() => {
        launchFlutterwavePayment(saved.regId, data);
      }, 1000);
    }
  });
});
