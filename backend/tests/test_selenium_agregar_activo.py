# Lakshmi Q2 - Gestión de Inversiones
# Módulo: Tests
# Autor: Luis Yhaser Olmos Torres
# Institución: Tecnológico de Monterrey
# Fecha de creación: 2026-05-02
#
"""
Tests Selenium para el flujo de agregar activo en Lakshmi Q2.

Prerequisitos:
    - Backend corriendo: python run.py  (puerto 5000)
    - Frontend corriendo: npm run dev   (puerto 3000)
    - Chrome instalado

Ejecutar:
    python -m pytest tests/test_selenium_agregar_activo.py -v
"""

import time

import pytest
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

BASE_URL = "http://localhost:3000"
TIMEOUT = 15


@pytest.fixture(scope="module")
def driver():
    """Inicia Chrome en modo headless para los tests."""
    opts = Options()
    opts.add_argument("--headless=new")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--window-size=1920,1080")
    drv = webdriver.Chrome(options=opts)
    drv.implicitly_wait(5)
    yield drv
    drv.quit()


@pytest.fixture(scope="module")
def wait(driver):
    return WebDriverWait(driver, TIMEOUT)


def _ir_a_portafolios(driver, wait):
    """Navega a la página de portafolios."""
    driver.get(BASE_URL)
    # Esperar a que cargue la app
    wait.until(EC.presence_of_element_located((By.TAG_NAME, "main")))
    # Buscar link/botón de Portafolios en la navegación
    nav_links = driver.find_elements(By.CSS_SELECTOR, "nav a, aside a")
    for link in nav_links:
        if "portafolio" in link.text.lower():
            link.click()
            time.sleep(1)
            return
    # Si no hay nav link, intentar URL directa
    driver.get(f"{BASE_URL}/portafolios")
    time.sleep(1)


def _asegurar_portafolio(driver, wait):
    """Asegura que exista al menos un portafolio y lo selecciona."""
    _ir_a_portafolios(driver, wait)
    time.sleep(2)

    # Buscar si hay algún portafolio en el sidebar
    sidebar_items = driver.find_elements(
        By.CSS_SELECTOR, "[aria-label*='portafolio'], [class*='sidebar'] button, [class*='Sidebar'] button"
    )
    if sidebar_items:
        sidebar_items[0].click()
        time.sleep(1)
        return True

    # Si no hay portafolios, crear uno
    crear_btns = driver.find_elements(By.XPATH, "//*[contains(text(), 'Crear') or contains(text(), 'Nuevo')]")
    if crear_btns:
        crear_btns[0].click()
        time.sleep(1)
        # Llenar nombre
        nombre_input = wait.until(EC.presence_of_element_located(
            (By.CSS_SELECTOR, "input[name='nombre'], input[placeholder*='nombre']")
        ))
        nombre_input.clear()
        nombre_input.send_keys("Test Selenium")
        # Submit
        submit_btns = driver.find_elements(By.CSS_SELECTOR, "button[type='submit']")
        if submit_btns:
            submit_btns[0].click()
            time.sleep(2)
        # Seleccionar el portafolio recién creado
        sidebar_items = driver.find_elements(
            By.CSS_SELECTOR, "[class*='sidebar'] button, [class*='Sidebar'] button"
        )
        if sidebar_items:
            sidebar_items[0].click()
            time.sleep(1)
        return True

    return False


class TestAgregarActivo:
    """Tests para el flujo de agregar activo al portafolio."""

    def test_pagina_carga(self, driver, wait):
        """La página de portafolios carga correctamente."""
        _ir_a_portafolios(driver, wait)
        assert "localhost" in driver.current_url

    def test_boton_agregar_activo_visible(self, driver, wait):
        """El botón 'Agregar Activo' aparece cuando hay un portafolio seleccionado."""
        _asegurar_portafolio(driver, wait)
        btn = wait.until(EC.presence_of_element_located(
            (By.XPATH, "//button[contains(., 'Agregar Activo')]")
        ))
        assert btn.is_displayed()

    def test_modal_se_abre(self, driver, wait):
        """Al hacer clic en 'Agregar Activo', se abre el modal."""
        _asegurar_portafolio(driver, wait)
        btn = wait.until(EC.element_to_be_clickable(
            (By.XPATH, "//button[contains(., 'Agregar Activo')]")
        ))
        btn.click()
        time.sleep(1)

        # Verificar que el modal está visible
        modal = wait.until(EC.presence_of_element_located(
            (By.XPATH, "//*[contains(text(), 'Agregar Activo') and (self::h2 or self::h3 or self::div)]")
        ))
        assert modal.is_displayed()

    def test_label_fecha_transaccion(self, driver, wait):
        """El campo de fecha tiene el label 'Fecha Transacción'."""
        _asegurar_portafolio(driver, wait)
        btn = wait.until(EC.element_to_be_clickable(
            (By.XPATH, "//button[contains(., 'Agregar Activo')]")
        ))
        btn.click()
        time.sleep(1)

        label = wait.until(EC.presence_of_element_located(
            (By.XPATH, "//label[contains(text(), 'Fecha Transacción')]")
        ))
        assert label.is_displayed()

    def test_fecha_default_dia_habil(self, driver, wait):
        """La fecha por defecto es un día hábil (lun-vie)."""
        _asegurar_portafolio(driver, wait)
        btn = wait.until(EC.element_to_be_clickable(
            (By.XPATH, "//button[contains(., 'Agregar Activo')]")
        ))
        btn.click()
        time.sleep(1)

        fecha_input = wait.until(EC.presence_of_element_located(
            (By.CSS_SELECTOR, "input[type='date']")
        ))
        valor = fecha_input.get_attribute("value")
        assert valor, "El campo fecha debería tener un valor por defecto"

        # Parsear y verificar que es lun-vie (0=lun, 4=vie en Python)
        from datetime import date
        partes = valor.split("-")
        d = date(int(partes[0]), int(partes[1]), int(partes[2]))
        assert d.weekday() < 5, f"La fecha {valor} es fin de semana (weekday={d.weekday()})"

    def test_ticker_carga_precio(self, driver, wait):
        """Al escribir un ticker válido, el precio se carga automáticamente."""
        _asegurar_portafolio(driver, wait)
        btn = wait.until(EC.element_to_be_clickable(
            (By.XPATH, "//button[contains(., 'Agregar Activo')]")
        ))
        btn.click()
        time.sleep(1)

        # Escribir ticker
        ticker_input = wait.until(EC.presence_of_element_located(
            (By.CSS_SELECTOR, "input[name='ticker'], input#tx-ticker")
        ))
        ticker_input.clear()
        ticker_input.send_keys("AAPL")
        time.sleep(1)

        # Seleccionar del autocomplete si aparece
        sugerencias = driver.find_elements(By.CSS_SELECTOR, "[role='option']")
        if sugerencias:
            sugerencias[0].click()
        time.sleep(3)  # Esperar debounce + fetch

        # Verificar que el precio se llenó
        precio_input = driver.find_element(
            By.CSS_SELECTOR, "input[name='precio_unitario'], input#tx-precio"
        )
        valor_precio = precio_input.get_attribute("value")
        assert valor_precio and float(valor_precio) > 0, (
            f"El precio debería haberse cargado automáticamente, pero es: '{valor_precio}'"
        )

    def test_ticker_minusculas_carga_precio(self, driver, wait):
        """Un ticker en minúsculas también carga el precio (fix del bug)."""
        _asegurar_portafolio(driver, wait)
        btn = wait.until(EC.element_to_be_clickable(
            (By.XPATH, "//button[contains(., 'Agregar Activo')]")
        ))
        btn.click()
        time.sleep(1)

        ticker_input = wait.until(EC.presence_of_element_located(
            (By.CSS_SELECTOR, "input#tx-ticker")
        ))
        ticker_input.clear()
        ticker_input.send_keys("aapl")
        # No seleccionar del autocomplete — escribir directamente
        # Hacer tab para salir del campo y que se dispare el fetch
        ticker_input.send_keys(Keys.TAB)
        time.sleep(4)  # Esperar debounce (600ms) + fetch

        precio_input = driver.find_element(By.CSS_SELECTOR, "input#tx-precio")
        valor_precio = precio_input.get_attribute("value")
        assert valor_precio and float(valor_precio) > 0, (
            f"El precio debería cargarse incluso con ticker en minúsculas, pero es: '{valor_precio}'"
        )

    def test_botones_posicion_izquierda(self, driver, wait):
        """Los botones Optimizar y Agregar Activo están a la izquierda del header."""
        _asegurar_portafolio(driver, wait)

        # Obtener posición X del nombre del portafolio
        h2 = wait.until(EC.presence_of_element_located(
            (By.CSS_SELECTOR, "section[aria-label*='Detalle'] h2")
        ))
        h2_right = h2.location["x"] + h2.size["width"]

        # Obtener posición X del botón Agregar Activo
        agregar_btn = driver.find_element(
            By.XPATH, "//button[contains(., 'Agregar Activo')]"
        )
        agregar_x = agregar_btn.location["x"]

        # El botón debe estar cerca del nombre (a la derecha, pero no al extremo)
        # Verificar que está más cerca del nombre que del borde derecho
        viewport_width = driver.execute_script("return window.innerWidth")
        distancia_al_nombre = agregar_x - h2_right
        distancia_al_borde = viewport_width - agregar_x

        assert distancia_al_nombre < distancia_al_borde, (
            f"El botón Agregar Activo debería estar más cerca del nombre que del borde derecho. "
            f"Distancia al nombre: {distancia_al_nombre}px, al borde: {distancia_al_borde}px"
        )

    def test_cerrar_modal(self, driver, wait):
        """El modal se cierra al hacer clic en Cancelar."""
        _asegurar_portafolio(driver, wait)
        btn = wait.until(EC.element_to_be_clickable(
            (By.XPATH, "//button[contains(., 'Agregar Activo')]")
        ))
        btn.click()
        time.sleep(1)

        cancelar = wait.until(EC.element_to_be_clickable(
            (By.XPATH, "//button[contains(text(), 'Cancelar')]")
        ))
        cancelar.click()
        time.sleep(1)

        # Verificar que el modal ya no está visible
        modals = driver.find_elements(
            By.XPATH, "//form[@aria-label='Formulario de transacción']"
        )
        visible = [m for m in modals if m.is_displayed()]
        assert len(visible) == 0, "El modal debería haberse cerrado"
