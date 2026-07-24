/* ═══════════════════════════════════════
   SilverVerse — Step-by-step Registration
   ═══════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var cta = params.get('cta');
  var eventId = params.get('event') || '';

  // Fetch event data if eventId or use trending
  (async function loadEvent() {
    var url = eventId ? '/api/events/' + eventId : '/api/events/trending';
    try {
      var r = await fetch(url);
      var d = await r.json();
      if (d.success && d.data) {
        var ev = d.data;
        eventId = ev.id;
        var titleEl = document.getElementById('htmlTitle');
        if (titleEl) titleEl.textContent = 'Register | ' + (ev.name || 'SilverVerse');
        var metaDesc = document.getElementById('metaDesc');
        if (metaDesc) metaDesc.content = 'Register for ' + (ev.name || 'Voices & Visions Festival') + '. Choose your category and secure your spot.';
        var regTitle = document.getElementById('registerTitle');
        if (regTitle && cta) regTitle.textContent = cta === 'contestant' ? 'Compete at ' + ev.name : 'Attend ' + ev.name;
        else if (regTitle) regTitle.textContent = 'Register for ' + (ev.name || 'the Festival');
        var regSub = document.getElementById('registerSubtitle');
        if (regSub) regSub.textContent = ev.name ? ev.name + ' — Choose your path and join us' : 'Choose your path and join the festival';

        // update CTA cards to preserve eventId
        var ctaCards = document.querySelectorAll('.cta-card');
        if (ctaCards.length) {
          ctaCards[0].href = 'register.html?cta=contestant&event=' + ev.id;
          ctaCards[1].href = 'register.html?cta=user&event=' + ev.id;
        }
      }
    } catch (_e) {}
  })();

  // Restore form state after payment redirect
  var returnStep = params.get('step');
  var returnTxRef = params.get('tx_ref');
  var savedData = sessionStorage.getItem('svRegData');
  if (returnStep === '4' && returnTxRef && savedData) {
    try {
      var restored = JSON.parse(savedData);
      for (var k in restored) { if (restored.hasOwnProperty(k)) registrationData[k] = restored[k]; }
      registrationData.paymentTxRef = returnTxRef;
      registrationData.paymentVerified = true;
      sessionStorage.removeItem('svRegData');
      sessionStorage.removeItem('svRegStep');
      sessionStorage.removeItem('svTxRef');
    } catch (_e) {}
  }

  // If no CTA, show selection cards
  if (!cta) {
    document.getElementById('ctaSelection').style.display = 'block';
    return;
  }

  // Show step form
  document.getElementById('stepForm').style.display = 'block';

  // Set title based on CTA
  if (cta === 'contestant') {
    document.getElementById('registerTitle').textContent = 'Register as a Contestant';
    document.getElementById('registerSubtitle').textContent = 'Showcase your talent on the biggest stage';
  } else {
    document.getElementById('registerTitle').textContent = 'Register to Attend';
    document.getElementById('registerSubtitle').textContent = 'Be part of the Voices & Visions experience';
  }

  var currentStep = 1;
  var isAuth = false;
  var authUser = null;
  var registrationData = {
    cta: cta,
    eventId: Number(eventId) || 0,
    category: '',
    subCategory: '',
    volunteerArea: '',
    speakerType: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    profileImage: null,
    talentDescription: '',
    perfTime: '',
    ticketType: 'Regular',
    amount: 1000
  };
  var pendingProfileFile = null;

  // ── Auth Check ──
  async function checkAuth() {
    try {
      var res = await fetch('/api/auth/me', { credentials: 'same-origin' });
      var data = await res.json();
      if (data.success && data.user) {
        isAuth = true;
        authUser = data.user;
        var nameParts = (authUser.displayName || authUser.username || '').split(' ');
        registrationData.firstName = nameParts[0] || '';
        registrationData.lastName = nameParts.slice(1).join(' ') || '';
        registrationData.email = authUser.email || '';
        registrationData.phone = authUser.phone || '';
        var step4Label = document.querySelector('.step-item[data-step="4"] .step-label');
        if (step4Label) step4Label.textContent = 'Confirm';
      }
    } catch (_e) {}
  }

  // ── STEP 1: Category Selection ──
  function renderStep1() {
    var step1 = document.getElementById('step1');

    if (cta === 'contestant') {
      step1.innerHTML = '' +
        '<h2>What do you perform?</h2>' +
        '<p class="step-desc">Select your talent category</p>' +
        '<div class="category-image-grid">' +
          '<label class="category-image-card">' +
            '<input type="radio" name="subcategory" value="Music">' +
            '<img src="assets/images/singer.jpg" alt="Music and singing performance" width="400" height="250" loading="lazy">' +
            '<div class="card-overlay"><span class="cat-name">Music / Singing</span></div>' +
          '</label>' +
          '<label class="category-image-card">' +
            '<input type="radio" name="subcategory" value="Dancing">' +
            '<img src="assets/images/performer.jpg" alt="Dance performance" width="400" height="250" loading="lazy">' +
            '<div class="card-overlay"><span class="cat-name">Dancing</span></div>' +
          '</label>' +
          '<label class="category-image-card">' +
            '<input type="radio" name="subcategory" value="Spoken Word">' +
            '<img src="assets/images/spoken-word.jpg" alt="Spoken word and poetry" width="400" height="250" loading="lazy">' +
            '<div class="card-overlay"><span class="cat-name">Spoken Word / Poetry</span></div>' +
          '</label>' +
          '<label class="category-image-card">' +
            '<input type="radio" name="subcategory" value="Modelling">' +
            '<img src="assets/images/modelling.jpg" alt="Modelling and runway" width="400" height="250" loading="lazy">' +
            '<div class="card-overlay"><span class="cat-name">Modelling</span></div>' +
          '</label>' +
          '<label class="category-image-card">' +
            '<input type="radio" name="subcategory" value="Instrumental">' +
            '<img src="assets/images/instrumental.jpg" alt="Instrumental performance" width="400" height="250" loading="lazy">' +
            '<div class="card-overlay"><span class="cat-name">Instrumental Performance</span></div>' +
          '</label>' +
          '<label class="category-image-card">' +
            '<input type="radio" name="subcategory" value="Drama">' +
            '<img src="assets/images/stage.jpg" alt="Drama and acting" width="400" height="250" loading="lazy">' +
            '<div class="card-overlay"><span class="cat-name">Drama / Acting</span></div>' +
          '</label>' +
          '<label class="category-image-card">' +
            '<input type="radio" name="subcategory" value="Comedy">' +
            '<img src="assets/images/comedy.jpg" alt="Stand-up comedy" width="400" height="250" loading="lazy">' +
            '<div class="card-overlay"><span class="cat-name">Comedy</span></div>' +
          '</label>' +
          '<label class="category-image-card">' +
            '<input type="radio" name="subcategory" value="Out-of-the-Box">' +
            '<img src="assets/images/creative.jpg" alt="Creative out-of-the-box talent" width="400" height="250" loading="lazy">' +
            '<div class="card-overlay"><span class="cat-name">Out-of-the-Box Talent</span></div>' +
          '</label>' +
        '</div>' +
        '<div class="specify-field" id="specifyField" style="display:none;">' +
          '<label for="specifyTalent">Specify your talent *</label>' +
          '<input type="text" id="specifyTalent" placeholder="e.g., Beatboxing, Spoken Word, Digital Art...">' +
        '</div>' +
        '<div class="form-actions">' +
          '<a href="register.html" class="btn btn-outline">&larr; Back</a>' +
          '<button type="button" class="btn btn-primary" onclick="window._goToStep(2)">Next &rarr;</button>' +
        '</div>';

      // Show specify field when "Out-of-the-Box" is selected
      step1.querySelectorAll('input[name="subcategory"]').forEach(function (radio) {
        radio.addEventListener('change', function () {
          var field = document.getElementById('specifyField');
          if (field) field.style.display = this.value === 'Out-of-the-Box' ? 'block' : 'none';
        });
      });
    } else {
      step1.innerHTML = '' +
        '<h2>How will you attend?</h2>' +
        '<p class="step-desc">Choose your attendance type</p>' +
        '<div class="category-image-grid">' +
          '<label class="category-image-card">' +
            '<input type="radio" name="category" value="Spectator">' +
            '<img src="assets/images/audience.jpg" alt="Spectator attending the festival" width="400" height="250" loading="lazy">' +
            '<div class="card-overlay"><span class="cat-name">Spectator</span></div>' +
          '</label>' +
          '<label class="category-image-card">' +
            '<input type="radio" name="category" value="VIP">' +
            '<img src="assets/images/hero-event.jpg" alt="VIP guest experience" width="400" height="250" loading="lazy">' +
            '<div class="card-overlay"><span class="cat-name">VIP Guest</span></div>' +
          '</label>' +
          '<label class="category-image-card">' +
            '<input type="radio" name="category" value="Volunteer">' +
            '<img src="assets/images/volunteer-team.jpg" alt="Join as a volunteer" width="400" height="250" loading="lazy">' +
            '<div class="card-overlay"><span class="cat-name">Volunteer</span></div>' +
          '</label>' +
          '<label class="category-image-card">' +
            '<input type="radio" name="category" value="Speaker">' +
            '<img src="assets/images/speaker.jpg" alt="Speaker at the festival" width="400" height="250" loading="lazy">' +
            '<div class="card-overlay"><span class="cat-name">Speaker</span></div>' +
          '</label>' +
        '</div>' +
        '<div id="volunteerSubs" style="display:none;">' +
          '<h3 style="margin-top:24px;">Select your area</h3>' +
          '<div class="subcategory-grid">' +
            '<div class="subcat-option"><input type="radio" name="volunteerArea" id="vol-media" value="Media"><label for="vol-media"><span class="subcat-icon"><img src="assets/images/volunteer-media.jpg" alt="Media" width="24" height="24" style="border-radius:4px;object-fit:cover;"></span>Media</label></div>' +
            '<div class="subcat-option"><input type="radio" name="volunteerArea" id="vol-logistics" value="Logistics"><label for="vol-logistics"><span class="subcat-icon"><img src="assets/images/volunteer-logistics.jpg" alt="Logistics" width="24" height="24" style="border-radius:4px;object-fit:cover;"></span>Logistics</label></div>' +
            '<div class="subcat-option"><input type="radio" name="volunteerArea" id="vol-registration" value="Registration"><label for="vol-registration"><span class="subcat-icon"><img src="assets/images/volunteer-checkin.jpg" alt="Registration" width="24" height="24" style="border-radius:4px;object-fit:cover;"></span>Registration</label></div>' +
            '<div class="subcat-option"><input type="radio" name="volunteerArea" id="vol-hospitality" value="Hospitality"><label for="vol-hospitality"><span class="subcat-icon"><img src="assets/images/volunteer-hospitality.jpg" alt="Hospitality" width="24" height="24" style="border-radius:4px;object-fit:cover;"></span>Hospitality</label></div>' +
            '<div class="subcat-option"><input type="radio" name="volunteerArea" id="vol-security" value="Security"><label for="vol-security"><span class="subcat-icon"><img src="assets/images/volunteer-security.jpg" alt="Security" width="24" height="24" style="border-radius:4px;object-fit:cover;"></span>Security</label></div>' +
          '</div>' +
        '</div>' +
        '<div id="speakerSubs" style="display:none;">' +
          '<h3 style="margin-top:24px;">Select your speaking type</h3>' +
          '<div class="subcategory-grid">' +
            '<div class="subcat-option"><input type="radio" name="speakerType" id="spk-keynote" value="Keynote"><label for="spk-keynote"><span class="subcat-icon">🎤</span>Keynote</label></div>' +
            '<div class="subcat-option"><input type="radio" name="speakerType" id="spk-panel" value="Panel"><label for="spk-panel"><span class="subcat-icon">💬</span>Panel Discussion</label></div>' +
            '<div class="subcat-option"><input type="radio" name="speakerType" id="spk-workshop" value="Workshop"><label for="spk-workshop"><span class="subcat-icon">🛠️</span>Workshop</label></div>' +
          '</div>' +
        '</div>' +
        '<div class="form-actions">' +
          '<a href="register.html" class="btn btn-outline">&larr; Back</a>' +
          '<button type="button" class="btn btn-primary" onclick="window._goToStep(2)">Next &rarr;</button>' +
        '</div>';

      // Toggle sub-selections
      step1.querySelectorAll('input[name="category"]').forEach(function (radio) {
        radio.addEventListener('change', function () {
          var vol = document.getElementById('volunteerSubs');
          var spk = document.getElementById('speakerSubs');
          if (vol) vol.style.display = this.value === 'Volunteer' ? 'block' : 'none';
          if (spk) spk.style.display = this.value === 'Speaker' ? 'block' : 'none';
          if (this.value === 'VIP') registrationData.ticketType = 'VIP';
          else registrationData.ticketType = 'Regular';
        });
      });
    }
  }

  // ── STEP 2: Personal Information ──
  function renderStep2() {
    var step2 = document.getElementById('step2');
    var isContestant = cta === 'contestant';

    step2.innerHTML = '' +
      '<h2>Personal Information</h2>' +
      '<p class="step-desc">Tell us about yourself</p>' +
      '<div class="form-row">' +
        '<div class="form-group">' +
          '<label for="firstName">First Name *</label>' +
          '<input type="text" id="firstName" required placeholder="Enter your first name" autocomplete="given-name">' +
        '</div>' +
        '<div class="form-group">' +
          '<label for="lastName">Last Name *</label>' +
          '<input type="text" id="lastName" required placeholder="Enter your last name" autocomplete="family-name">' +
        '</div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-group">' +
          '<label for="regEmail">Email Address *</label>' +
          '<input type="email" id="regEmail" required placeholder="you@example.com" autocomplete="email">' +
        '</div>' +
        '<div class="form-group">' +
          '<label for="regPhone">Phone Number *</label>' +
          '<input type="tel" id="regPhone" required placeholder="+234 xxx xxx xxxx" autocomplete="tel">' +
        '</div>' +
      '</div>' +
      (isContestant ?
        '<div class="form-group">' +
          '<label for="profileImage">Profile Photo * (Required for contestants)</label>' +
          '<div class="file-upload" id="profileUpload">' +
            '<p>Click to upload your photo</p>' +
            '<p class="upload-hint">PNG, JPG (max 5MB)</p>' +
            '<input type="file" id="profileImage" accept="image/*" style="display:none;">' +
          '</div>' +
          '<div id="profilePreview" class="profile-preview" style="display:none;"></div>' +
        '</div>' +
        '<div class="form-group">' +
          '<label for="talentDescription">Bio / Talent Description *</label>' +
          '<textarea id="talentDescription" rows="4" placeholder="Tell us about your talent, experience, and what makes you unique..."></textarea>' +
        '</div>' +
        '<div class="form-group">' +
          '<label for="perfTime">Preferred Performance Time</label>' +
          '<select id="perfTime">' +
            '<option value="">No preference</option>' +
            '<option value="9:00 AM">9:00 AM</option>' +
            '<option value="10:00 AM">10:00 AM</option>' +
            '<option value="11:00 AM">11:00 AM</option>' +
            '<option value="11:45 AM">11:45 AM</option>' +
            '<option value="12:30 PM">12:30 PM</option>' +
            '<option value="2:00 PM">2:00 PM</option>' +
            '<option value="3:00 PM">3:00 PM</option>' +
            '<option value="4:00 PM">4:00 PM</option>' +
          '</select>' +
        '</div>'
        :
        '<div class="form-group">' +
          '<label for="profileImage">Profile Photo (Optional)</label>' +
          '<div class="file-upload" id="profileUpload">' +
            '<p>Click to upload your photo</p>' +
            '<input type="file" id="profileImage" accept="image/*" style="display:none;">' +
          '</div>' +
          '<div id="profilePreview" class="profile-preview" style="display:none;"></div>' +
        '</div>'
      ) +
      '<div class="form-group">' +
        '<label for="ticketType">Ticket Type *</label>' +
        '<select id="ticketType">' +
          '<option value="Regular">Regular — &#8358;1,000</option>' +
          '<option value="VIP">VIP — &#8358;5,000</option>' +
          '<option value="VVIP">VVIP (Table for Four) — &#8358;10,000</option>' +
        '</select>' +
      '</div>' +
      '<div class="form-actions">' +
        '<button type="button" class="btn btn-outline" onclick="window._goToStep(1)">&larr; Back</button>' +
        '<button type="button" class="btn btn-primary" onclick="window._goToStep(3)">Next &rarr;</button>' +
      '</div>';

    // Restore saved values if navigating back
    if (registrationData.firstName) document.getElementById('firstName').value = registrationData.firstName;
    if (registrationData.lastName) document.getElementById('lastName').value = registrationData.lastName;
    if (registrationData.email) document.getElementById('regEmail').value = registrationData.email;
    if (registrationData.phone) document.getElementById('regPhone').value = registrationData.phone;
    if (registrationData.talentDescription) document.getElementById('talentDescription').value = registrationData.talentDescription;
    if (registrationData.perfTime) document.getElementById('perfTime').value = registrationData.perfTime;
    if (registrationData.ticketType) document.getElementById('ticketType').value = registrationData.ticketType;

    setupFileUpload();
    document.getElementById('ticketType').addEventListener('change', updatePaymentSummary);
  }

  // ── STEP 3: Payment ──
  function renderStep3() {
    var step3 = document.getElementById('step3');
    var prices = { Regular: 1000, VIP: 5000, VVIP: 10000 };
    var amount = prices[registrationData.ticketType] || 1000;

    step3.innerHTML = '' +
      '<h2>Payment</h2>' +
      '<p class="step-desc">Complete your registration payment</p>' +
      '<div class="payment-summary-card">' +
        '<div class="summary-header">' +
          '<span class="summary-label">Payment Summary</span>' +
          '<span class="summary-powered">Powered by Flutterwave</span>' +
        '</div>' +
        '<div class="summary-row">' +
          '<span class="label">Category</span>' +
          '<span class="value">' + escapeHtml(registrationData.subCategory || registrationData.category || 'Contestant') + '</span>' +
        '</div>' +
        '<div class="summary-row">' +
          '<span class="label">Ticket Type</span>' +
          '<span class="value" id="summaryTicketType">' + escapeHtml(registrationData.ticketType) + '</span>' +
        '</div>' +
        '<div class="summary-total">' +
          '<span class="label">Total Amount</span>' +
          '<span class="amount" id="summaryAmount">&#8358;' + amount.toLocaleString() + '</span>' +
        '</div>' +
        '<p class="summary-note">Secure payment processed via Flutterwave.</p>' +
      '</div>' +
      '<div id="flwCheckout" style="margin:24px 0;"></div>' +
      '<div class="form-actions">' +
        '<button type="button" class="btn btn-outline" onclick="window._goToStep(2)">&larr; Back</button>' +
        '<button type="button" class="btn btn-primary" id="payBtn" onclick="window._initPayment()">' +
          'Pay &#8358;' + amount.toLocaleString() + ' &rarr;' +
        '</button>' +
      '</div>';
  }

  // ── STEP 4: Account Setup / Confirm ──
  function renderStep4() {
    var step4 = document.getElementById('step4');

    if (isAuth) {
      var payBadge = registrationData.paymentVerified
        ? '<div class="payment-status-badge success"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Payment Verified</div>'
        : '<div class="payment-status-badge pending"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Payment Pending</div>';
      step4.innerHTML = '' +
        '<h2>Confirm Registration</h2>' +
        '<p class="step-desc">Review and confirm your registration</p>' +
        '<div class="payment-summary-card">' +
          '<div class="summary-header"><span class="summary-label">Registration Summary</span></div>' +
          '<div class="summary-row"><span class="label">Category</span><span class="value">' + escapeHtml(registrationData.subCategory || registrationData.category || 'N/A') + '</span></div>' +
          '<div class="summary-row"><span class="label">Ticket Type</span><span class="value">' + escapeHtml(registrationData.ticketType) + '</span></div>' +
          '<div class="summary-row"><span class="label">Name</span><span class="value">' + escapeHtml(registrationData.firstName + ' ' + registrationData.lastName) + '</span></div>' +
          '<div class="summary-row"><span class="label">Email</span><span class="value">' + escapeHtml(registrationData.email) + '</span></div>' +
          '<div class="summary-total"><span class="label">Total</span><span class="amount">&#8358;' + (registrationData.amount || 1000).toLocaleString() + '</span></div>' +
          payBadge +
        '</div>' +
        '<div class="form-group" style="margin-top:20px;">' +
          '<label class="checkbox-wrap" style="display:flex;align-items:center;gap:8px;cursor:pointer;">' +
            '<input type="checkbox" id="agree" required style="width:16px;height:16px;accent-color:var(--primary);cursor:pointer;">' +
            '<span style="font-size:0.85rem;color:var(--gray-600);">I agree to the <a href="#" onclick="event.preventDefault();openTCModal();" style="color:var(--primary);text-decoration:underline;">terms and conditions</a> *</span>' +
          '</label>' +
        '</div>' +
        '<div class="form-actions">' +
          '<button type="button" class="btn btn-outline" onclick="window._goToStep(3)">&larr; Back</button>' +
          '<button type="button" class="btn btn-primary" id="createAccountBtn" onclick="window._submitRegistration()">Get My Ticket &rarr;</button>' +
        '</div>';
      return;
    }

    step4.innerHTML = '' +
      '<h2>Set Up Your Account</h2>' +
      '<p class="step-desc">Create your SilverVerse account</p>' +
      (registrationData.paymentVerified
        ? '<div class="payment-status-badge success" style="margin-bottom:20px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Payment Verified — Complete your account to get your ticket</div>'
        : '') +
      '<div class="form-group">' +
        '<label for="username">What should we call you? *</label>' +
        '<input type="text" id="username" placeholder="Choose a username" required autocomplete="username">' +
        '<small id="usernameStatus" class="field-status"></small>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-group">' +
          '<label for="regPassword">Set Password *</label>' +
          '<div class="password-field">' +
            '<input type="password" id="regPassword" placeholder="Min 6 characters" required autocomplete="new-password">' +
            '<button type="button" class="password-toggle" aria-label="Show password" title="Show password">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>' +
            '</button>' +
          '</div>' +
        '</div>' +
        '<div class="form-group">' +
          '<label for="regConfirmPassword">Confirm Password *</label>' +
          '<div class="password-field">' +
            '<input type="password" id="regConfirmPassword" placeholder="Re-enter password" required autocomplete="new-password">' +
            '<button type="button" class="password-toggle" aria-label="Show password" title="Show password">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="form-group">' +
        '<label class="checkbox-wrap" style="display:flex;align-items:center;gap:8px;cursor:pointer;">' +
          '<input type="checkbox" id="agree" required style="width:16px;height:16px;accent-color:var(--primary);cursor:pointer;">' +
          '<span style="font-size:0.85rem;color:var(--gray-600);">I agree to the <a href="#" onclick="event.preventDefault();openTCModal();" style="color:var(--primary);text-decoration:underline;">terms and conditions</a> of the Voices &amp; Visions Festival 2026 *</span>' +
        '</label>' +
      '</div>' +
      '<div class="form-actions">' +
        '<button type="button" class="btn btn-outline" onclick="window._goToStep(3)">&larr; Back</button>' +
        '<button type="button" class="btn btn-primary" id="createAccountBtn" onclick="window._createAccount()">' +
          'Create Account &amp; Get Ticket &rarr;' +
        '</button>' +
      '</div>';

    // Password toggle for step 4 (non-auth only)
    if (!isAuth) {
    step4.querySelectorAll('.password-toggle').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var field = this.closest('.password-field');
        if (!field) return;
        var input = field.querySelector('input');
        if (!input) return;
        var isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        this.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
        if (isPassword) {
          this.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
        } else {
          this.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
        }
      });
    });

    // Username availability check (debounced)
    var usernameTimeout;
    document.getElementById('username').addEventListener('input', function () {
      clearTimeout(usernameTimeout);
      var val = this.value.trim();
      var status = document.getElementById('usernameStatus');
      if (val.length < 3) {
        status.textContent = '';
        status.className = 'field-status';
        return;
      }
      status.textContent = 'Checking...';
      status.className = 'field-status checking';
      usernameTimeout = setTimeout(function () {
        fetch('/api/auth/check-username', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: val })
        })
          .then(function (r) { return r.json(); })
          .then(function (d) {
            if (d.available) {
              status.textContent = '\u2713 Username available';
              status.className = 'field-status success';
            } else {
              status.textContent = '\u2717 Username taken';
              status.className = 'field-status error';
            }
          })
          .catch(function () {
            status.textContent = '';
            status.className = 'field-status';
          });
      }, 500);
    });
    }
  }

  // ── Navigation ──
  window._goToStep = function (step) {
    // Validate current step before advancing
    if (step > currentStep && !validateStep(currentStep)) return;

    // Save current step data
    saveStepData(currentStep);

    currentStep = step;

    // Update step indicator
    document.querySelectorAll('.step-item').forEach(function (item) {
      var s = parseInt(item.dataset.step, 10);
      item.classList.remove('active', 'done');
      if (s === step) item.classList.add('active');
      else if (s < step) item.classList.add('done');
    });

    // Show/hide steps
    document.querySelectorAll('.form-step').forEach(function (s) { s.classList.remove('active'); });
    var target = document.getElementById('step' + step);
    if (target) target.classList.add('active');

    // Render step content
    if (step === 1) renderStep1();
    else if (step === 2) renderStep2();
    else if (step === 3) renderStep3();
    else if (step === 4) renderStep4();

    // Scroll to top of form
    var card = document.querySelector('.register-card');
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  function validateStep(step) {
    if (step === 1) {
      if (cta === 'contestant') {
        var selected = document.querySelector('input[name="subcategory"]:checked');
        if (!selected) { showToast('Please select a category', 'error'); return false; }
        if (selected.value === 'Out-of-the-Box') {
          var specify = document.getElementById('specifyTalent');
          if (!specify || !specify.value.trim()) {
            showToast('Please specify your talent', 'error'); return false;
          }
        }
      } else {
        var selected = document.querySelector('input[name="category"]:checked');
        if (!selected) { showToast('Please select a category', 'error'); return false; }
        if (selected.value === 'Volunteer' && !document.querySelector('input[name="volunteerArea"]:checked')) {
          showToast('Please select a volunteer area', 'error'); return false;
        }
        if (selected.value === 'Speaker' && !document.querySelector('input[name="speakerType"]:checked')) {
          showToast('Please select a speaker type', 'error'); return false;
        }
      }
    }
    if (step === 2) {
      if (!document.getElementById('firstName').value.trim()) { showToast('First name is required', 'error'); return false; }
      if (!document.getElementById('lastName').value.trim()) { showToast('Last name is required', 'error'); return false; }
      if (!document.getElementById('regEmail').value.trim()) { showToast('Email is required', 'error'); return false; }
      if (!document.getElementById('regPhone').value.trim()) { showToast('Phone number is required', 'error'); return false; }
    }
    return true;
  }

  function saveStepData(step) {
    if (step === 1) {
      if (cta === 'contestant') {
        var sub = document.querySelector('input[name="subcategory"]:checked');
        registrationData.subCategory = sub ? sub.value : '';
        registrationData.category = 'Contestant';
        if (sub && sub.value === 'Out-of-the-Box') {
          var specify = document.getElementById('specifyTalent');
          registrationData.talent = specify ? specify.value : '';
        } else {
          registrationData.talent = sub ? sub.value : '';
        }
      } else {
        var cat = document.querySelector('input[name="category"]:checked');
        registrationData.category = cat ? cat.value : '';
        var vol = document.querySelector('input[name="volunteerArea"]:checked');
        registrationData.volunteerArea = vol ? vol.value : '';
        var spk = document.querySelector('input[name="speakerType"]:checked');
        registrationData.speakerType = spk ? spk.value : '';
        registrationData.ticketType = cat && cat.value === 'VIP' ? 'VIP' : 'Regular';
      }
    }
    if (step === 2) {
      registrationData.firstName = document.getElementById('firstName') ? document.getElementById('firstName').value.trim() : '';
      registrationData.lastName = document.getElementById('lastName') ? document.getElementById('lastName').value.trim() : '';
      registrationData.email = document.getElementById('regEmail') ? document.getElementById('regEmail').value.trim() : '';
      registrationData.phone = document.getElementById('regPhone') ? document.getElementById('regPhone').value.trim() : '';
      registrationData.ticketType = document.getElementById('ticketType') ? document.getElementById('ticketType').value : 'Regular';
      registrationData.talentDescription = document.getElementById('talentDescription') ? document.getElementById('talentDescription').value.trim() : '';
      registrationData.perfTime = document.getElementById('perfTime') ? document.getElementById('perfTime').value : '';
    }
  }

  // ── Payment ──
  function updatePaymentSummary() {
    var prices = { Regular: 1000, VIP: 5000, VVIP: 10000 };
    var ticketSelect = document.getElementById('ticketType');
    var type = ticketSelect ? ticketSelect.value : 'Regular';
    registrationData.ticketType = type;
    registrationData.amount = prices[type];
    var summaryTicket = document.getElementById('summaryTicketType');
    var summaryAmount = document.getElementById('summaryAmount');
    if (summaryTicket) summaryTicket.textContent = type;
    if (summaryAmount) summaryAmount.textContent = '\u20A6' + prices[type].toLocaleString();
  }

  window._initPayment = async function () {
    var prices = { Regular: 1000, VIP: 5000, VVIP: 10000 };
    var amount = prices[registrationData.ticketType] || 1000;
    var payBtn = document.getElementById('payBtn');

    if (payBtn) {
      payBtn.disabled = true;
      payBtn.textContent = 'Redirecting to payment...';
    }

    try {
      sessionStorage.setItem('svRegData', JSON.stringify(registrationData));
      sessionStorage.setItem('svRegStep', '2');

      var res = await fetch('/api/payment/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          regId: '',
          email: registrationData.email || '',
          firstName: registrationData.firstName || '',
          lastName: registrationData.lastName || '',
          phone: registrationData.phone || '',
          amount: amount,
          ticketType: registrationData.ticketType || 'Regular',
          paymentMethod: 'opay'
        })
      });

      if (res.status === 503) {
        showToast('Payment system is offline. Please contact support.', 'error');
        if (payBtn) { payBtn.disabled = true; payBtn.textContent = 'Payment Unavailable'; }
        return;
      }

      var data = await res.json();

      if (data.success && data.data && data.data.redirect_url) {
        sessionStorage.setItem('svTxRef', data.data.txRef);
        window.location.href = data.data.redirect_url;
      } else {
        showToast('Payment initiation failed. Please try again.', 'error');
        if (payBtn) { payBtn.disabled = false; payBtn.innerHTML = 'Pay &#8358;' + amount.toLocaleString() + ' &rarr;'; }
      }
    } catch (_e) {
      showToast('Payment error. Please try again.', 'error');
      if (payBtn) { payBtn.disabled = false; payBtn.innerHTML = 'Pay &#8358;' + amount.toLocaleString() + ' &rarr;'; }
    }
  };

  // ── Account Creation ──
  window._createAccount = async function () {
    var username = document.getElementById('username') ? document.getElementById('username').value.trim() : '';
    var password = document.getElementById('regPassword') ? document.getElementById('regPassword').value : '';
    var confirmPassword = document.getElementById('regConfirmPassword') ? document.getElementById('regConfirmPassword').value : '';
    var agree = document.getElementById('agree') ? document.getElementById('agree').checked : false;
    var createBtn = document.getElementById('createAccountBtn');

    if (!username || username.length < 3) { showToast('Username must be at least 3 characters', 'error'); return; }
    if (!password || password.length < 6) { showToast('Password must be at least 6 characters', 'error'); return; }
    if (password !== confirmPassword) { showToast('Passwords do not match', 'error'); return; }
    if (!agree) { showToast('Please agree to the terms', 'error'); return; }

    if (createBtn) {
      createBtn.disabled = true;
      createBtn.innerHTML = '<span class="btn-text">Creating account...</span>';
    }

    try {
      // 1. Create account
      var signupRes = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          username: username,
          email: registrationData.email,
          phone: registrationData.phone,
          password: password,
          displayName: registrationData.firstName + ' ' + registrationData.lastName
        })
      });
      var signupData = await signupRes.json();
      if (!signupData.success) throw new Error(signupData.message || 'Signup failed');

      // Upload profile image now that we're authenticated
      if (pendingProfileFile) {
        try {
          var fd = new FormData();
          fd.append('image', pendingProfileFile);
          var upRes = await fetch('/api/upload/profile', { method: 'POST', body: fd, credentials: 'same-origin' });
          var upData = await upRes.json();
          if (upData.success && upData.url) {
            registrationData.profileImage = upData.url;
          }
        } catch (_e) {}
      }

      // 2. Create registration
      var txRef = registrationData.paymentTxRef || sessionStorage.getItem('svTxRef') || '';
      var regRes = await fetch('/api/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          category: registrationData.category,
          subCategory: registrationData.subCategory || registrationData.volunteerArea || registrationData.speakerType || '',
          ticketType: registrationData.ticketType,
          firstName: registrationData.firstName,
          lastName: registrationData.lastName,
          email: registrationData.email,
          phone: registrationData.phone,
          talent: registrationData.talent || registrationData.subCategory || '',
          talentDescription: registrationData.talentDescription,
          perfTime: registrationData.perfTime,
          amount: registrationData.amount,
          profileImage: registrationData.profileImage || '',
          paymentTxRef: txRef,
          paymentStatus: txRef ? 'verified' : 'pending',
          eventId: Number(eventId) || 0
        })
      });
      var regData = await regRes.json();
      if (!regData.success) throw new Error(regData.message || 'Registration failed');

      // 3. Show success
      document.getElementById('stepForm').style.display = 'none';
      var stepBar = document.querySelector('.step-bar');
      if (stepBar) stepBar.style.display = 'none';
      var success = document.getElementById('registerSuccess');
      success.style.display = 'block';
      document.getElementById('displayRegId').textContent = regData.regId;

      showToast('Registration successful! Welcome to SilverVerse!');

      // 4. Redirect to dashboard after 3s
      setTimeout(function () {
        window.location.href = 'dashboard.html';
      }, 3000);

    } catch (err) {
      showToast(err.message, 'error');
      if (createBtn) {
        createBtn.disabled = false;
        createBtn.innerHTML = 'Create Account &amp; Get Ticket &rarr;';
      }
    }
  };

  // ── Submit Registration (Auth users) ──
  window._submitRegistration = async function () {
    var agree = document.getElementById('agree') ? document.getElementById('agree').checked : false;
    if (!agree) { showToast('Please agree to the terms and conditions', 'error'); return; }
    var btn = document.getElementById('createAccountBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="btn-text">Submitting...</span>'; }
    try {
      // Upload profile image if pending
      if (pendingProfileFile) {
        try {
          var fd = new FormData();
          fd.append('image', pendingProfileFile);
          var upRes = await fetch('/api/upload/profile', { method: 'POST', body: fd, credentials: 'same-origin' });
          var upData = await upRes.json();
          if (upData.success && upData.url) {
            registrationData.profileImage = upData.url;
          }
        } catch (_e) {}
      }
      var txRef2 = registrationData.paymentTxRef || sessionStorage.getItem('svTxRef') || '';
      var regRes = await fetch('/api/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          category: registrationData.category,
          subCategory: registrationData.subCategory || registrationData.volunteerArea || registrationData.speakerType || '',
          ticketType: registrationData.ticketType,
          firstName: registrationData.firstName,
          lastName: registrationData.lastName,
          email: registrationData.email,
          phone: registrationData.phone,
          talent: registrationData.talent || registrationData.subCategory || '',
          talentDescription: registrationData.talentDescription,
          perfTime: registrationData.perfTime,
          amount: registrationData.amount,
          profileImage: registrationData.profileImage || '',
          paymentTxRef: txRef2,
          paymentStatus: txRef2 ? 'verified' : 'pending',
          eventId: Number(eventId) || 0
        })
      });
      var regData = await regRes.json();
      if (!regData.success) throw new Error(regData.message || 'Registration failed');
      document.getElementById('stepForm').style.display = 'none';
      var stepBar = document.querySelector('.step-bar');
      if (stepBar) stepBar.style.display = 'none';
      var success = document.getElementById('registerSuccess');
      success.style.display = 'block';
      document.getElementById('displayRegId').textContent = regData.regId;
      showToast('Registration successful!');
      setTimeout(function () { window.location.href = 'dashboard.html'; }, 3000);
    } catch (err) {
      showToast(err.message, 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = 'Get My Ticket &rarr;'; }
    }
  };

  // ── Helpers ──
  function setupFileUpload() {
    var upload = document.getElementById('profileUpload');
    var input = document.getElementById('profileImage');
    if (!upload || !input) return;

    upload.addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () {
      if (this.files.length) {
        var file = this.files[0];
        var preview = document.getElementById('profilePreview');
        if (preview && file.type.startsWith('image/')) {
          pendingProfileFile = file;
          var reader = new FileReader();
          reader.onload = function (e) {
            registrationData.profileImage = e.target.result;
            preview.innerHTML = '<img src="' + e.target.result + '" alt="Profile preview" style="width:120px;height:120px;object-fit:cover;border-radius:50%;border:3px solid var(--primary);">';
            preview.style.display = 'block';
            upload.innerHTML = '<p>' + escapeHtml(file.name) + ' (' + (file.size / 1024).toFixed(1) + ' KB)</p>';
          };
          reader.readAsDataURL(file);
        }
      }
    });
  }

  function showToast(message, type) {
    type = type || 'success';
    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function () { toast.remove(); }, 3500);
  }

  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ── Initialize ──
  checkAuth().then(function () {
    if (registrationData.paymentVerified) {
      // Skip directly to step 4 (payment confirmed, just confirm/submit)
      currentStep = 4;
      document.querySelectorAll('.step-item').forEach(function (item) {
        var s = parseInt(item.dataset.step, 10);
        item.classList.remove('active', 'done');
        if (s === 4) item.classList.add('active');
        else if (s < 4) item.classList.add('done');
      });
      document.querySelectorAll('.form-step').forEach(function (s) { s.classList.remove('active'); });
      var target = document.getElementById('step4');
      if (target) target.classList.add('active');
      renderStep4();
    } else {
      renderStep1();
    }
  });
});
